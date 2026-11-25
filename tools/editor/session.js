import * as Blocks from "../bake/blocks.js";
import * as FineMesher from "../../js/render/fine-mesher.js";
import * as Objects from "../bake/objects.js";
import * as Props from "../bake/props.js";
import * as Recipe from "../terrain/recipe.js";
import * as RegionCodec from "../../js/sim/region-codec.js";
import * as Terrain from "../bake/terrain.js";
import * as TerrainMap from "../terrain/map.js";
import * as Voxelise from "../bake/voxelise.js";
import * as WorldTextures from "../bake/world-textures.js";
import * as Zones from "../bake/zones.js";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

const { CHUNK, CELLS, REGION } = RegionCodec;
const CUBES = Terrain.CUBES_PER_METRE;
const QUARTER = Math.PI / 2;
const PRECISION = 1e6;
const LEVEL = 1;
const MAX_AGE = 100;
const MAX_CAPTURE = { prefab: 96, object: 8 };
const CAPTURED = { prefab: "prefabs", object: "objects" };
const LAYOUTS = path.join("props", "layouts.json");
const ID_PATTERN = /^[a-z][A-Za-z0-9]*$/;
const NEW_ZONE = { sizes: [128, 256, 512, 1024], height: 256, base: 48 };


/******************************************************************************/
/* EDIT SESSION                                                               */
/******************************************************************************/

// Each `apply` is one step that `undo` reverses. Nothing reaches content/
// until `save`.
export class EditSession
{
    static async open(id, contentRoot)
    {
        const folder = path.join(contentRoot, "zones", id);
        const zone = JSON.parse(fs.readFileSync(path.join(folder, "zone.json"), "utf8"));

        if(!Terrain.isLocked(folder) && zone.terrain === undefined) { throw new Error("Zone zones/" + id + " has no locked terrain or terrain recipe to edit. Run node tools/lock-terrain.js " + id); }
        if(Terrain.isLocked(folder) && zone.terrain !== undefined) { throw new Error("Zone zones/" + id + " has locked cubes and a terrain recipe; delete the recipe."); }

        return EditSession.start(id, folder, contentRoot, zone);
    }

    // A new zone lives only in the session until it is saved. It takes the
    // starter recipe and the lighting of the zone `from`.
    static async create(id, contentRoot, { name, size, from })
    {
        const folder = path.join(contentRoot, "zones", id);
        const fromPath = path.join(contentRoot, "zones", String(from), "zone.json");

        if(!ID_PATTERN.test(id)) { throw new Error("A zone's id starts with a lower-case letter and holds only letters and digits."); }
        if(fs.existsSync(folder)) { throw new Error("There is already a zone called " + id + "."); }
        if(typeof name !== "string" || name.trim() === "") { throw new Error("A new zone needs a name."); }
        if(!NEW_ZONE.sizes.includes(size)) { throw new Error("A new zone is " + NEW_ZONE.sizes.join(", ") + " metres across."); }
        if(!ID_PATTERN.test(String(from)) || !fs.existsSync(fromPath)) { throw new Error("There is no zone " + from + " to take the lighting from."); }

        const zone =
        {
            id,
            name: name.trim(),
            welcome: ["You arrive in " + name.trim() + "."],
            columns: size * CUBES,
            height: NEW_ZONE.height,
            base: NEW_ZONE.base,
            water: NEW_ZONE.base + Math.round(Recipe.WATER.value * CUBES),
            lighting: JSON.parse(fs.readFileSync(fromPath, "utf8")).lighting,
            spawn: { x: 0, z: 0, heading: 0 },
            people: { seed: 1, residents: [] },
            props: [],
            terrain: Recipe.starter(),
        };

        return EditSession.start(id, folder, contentRoot, zone);
    }

    static async start(id, folder, contentRoot, zone)
    {
        const problems = [];
        const context = {};

        for(const baker of [WorldTextures, Blocks, Props, Objects]) { await baker.bake(problems, context); }

        if(problems.length > 0) { throw new Error(problems.join("\n")); }

        const numbers = Object.fromEntries(context.blocks.map((block, i) => [block.id, i + 1]));
        const terrain = Terrain.isLocked(folder) ? Terrain.readLocked(folder, zone, numbers, "Zone zones/" + id, problems) : null;
        const layoutsPath = path.join(contentRoot, LAYOUTS);
        const layouts = fs.existsSync(layoutsPath) ? JSON.parse(fs.readFileSync(layoutsPath, "utf8")) : {};
        const session = new EditSession({ id, folder, contentRoot, zone, terrain, context, layouts, people: await Zones.loadPeople() });

        if(problems.length > 0) { throw new Error(problems.join("\n")); }

        session.setLayouts(layouts);

        if(!terrain) { session.syncTerrain([]); }

        await session.bake(null);

        return session;
    }

    constructor({ id, folder, contentRoot, zone, terrain, context, layouts, people })
    {
        this.id = id;
        this.folder = folder;
        this.contentRoot = contentRoot;
        this.zone = zone;
        this.terrain = terrain;
        this.context = context;
        this.layouts = layouts;
        this.savedLayouts = JSON.stringify(layouts);
        this.people = people;
        this.numbers = Object.fromEntries(context.blocks.map((block, i) => [block.id, i + 1]));
        this.files = new Map();
        this.index = null;
        this.placed = new Map();
        this.history = [];
        this.future = [];
        this.editedRegions = new Set();
        this.unsettled = new Set();
        this.chunkMaps = new Map();
        this.generatedFrom = null;
    }

    // A zone not locked in yet holds its recipe, and its water level in
    // metres for the terrain panel.
    get state()
    {
        const terrain = this.isLocked ? {} : { recipe: this.zone.terrain, water: (this.zone.water - this.zone.base) / CUBES };

        return { isDirty: this.history.length > 0, canUndo: this.history.length > 0, canRedo: this.future.length > 0, steps: this.history.length, isLocked: this.isLocked, ...terrain };
    }

    get isLocked()
    {
        return this.zone.terrain === undefined;
    }

    // The baked file at `name`, a path inside the zone's asset folder, or null.
    file(name)
    {
        return this.files.get(name) ?? null;
    }

    manifestEntries()
    {
        const entries = [...this.files].map(([name, bytes]) => ["zones/" + this.id + "/" + name, { sha256: crypto.createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length }]);

        return Object.fromEntries(entries);
    }

    /* STEPS ******************************************************************/

    // Applies a list of operations as one step. Cells that belong to a
    // placement are refused, and named in `refused`.
    async apply(operations)
    {
        const before = this.snapshot();
        const step = { zone: [before.zone, null], layouts: [before.layouts, null], cells: [], ages: [] };
        const refused = [];
        const messages = [];

        for(const operation of operations) { this.operate(operation, step, refused, messages); }

        this.settleSurfaces();
        step.zone[1] = JSON.stringify(this.zone);
        step.layouts[1] = JSON.stringify(this.layouts);

        const isChanged = step.cells.length > 0 || step.ages.length > 0 || step.zone[0] !== step.zone[1] || step.layouts[0] !== step.layouts[1];

        if(isChanged)
        {
            this.history.push(step);
            this.future = [];
        }

        if(!isChanged) { return { regions: [], refused, messages, ...this.state }; }

        try
        {
            return { regions: await this.bakeStep(step, messages), refused, messages, ...this.state };
        }
        catch(error)
        {
            this.history.pop();
            this.restore(step, 0);
            await this.bakeStep(step, []);

            throw error;
        }
    }

    async undo()
    {
        const step = this.history.pop();

        if(!step) { return { regions: [], ...this.state }; }

        this.restore(step, 0);
        this.future.push(step);

        return { regions: await this.bakeStep(step, []), ...this.state };
    }

    async redo()
    {
        const step = this.future.pop();

        if(!step) { return { regions: [], ...this.state }; }

        this.restore(step, 1);
        this.history.push(step);

        return { regions: await this.bakeStep(step, []), ...this.state };
    }

    snapshot()
    {
        return { zone: JSON.stringify(this.zone), layouts: JSON.stringify(this.layouts) };
    }

    // `side` 0 restores the step's start and 1 its end.
    restore(step, side)
    {
        this.zone = JSON.parse(step.zone[side]);
        this.setLayouts(JSON.parse(step.layouts[side]));

        const cells = side === 0 ? [...step.cells].reverse() : step.cells;

        for(const [x, y, z, old, block] of cells) { this.setCell(x, y, z, side === 0 ? old : block); }

        const ages = side === 0 ? [...step.ages].reverse() : step.ages;

        for(const [column, row, old, painted] of ages) { this.setAge(column, row, side === 0 ? old : painted); }

        this.settleSurfaces();
    }

    setLayouts(layouts)
    {
        this.layouts = layouts;

        for(const [id, prefab] of Object.entries(this.context.prefabs))
        {
            if(layouts[id]) { prefab.layout = layouts[id]; }
            else { delete prefab.layout; }
        }
    }

    /* OPERATIONS *************************************************************/

    operate(operation, step, refused, messages)
    {
        const props = this.zone.props;
        const prop = props[operation.prop];

        if(!this.isLocked && ["cubes", "breakApart", "ages"].includes(operation.type))
        {
            messages.push("Lock in the terrain before changing its cubes or ages.");
            refused.push(...(operation.cells ?? []).map(([x, y, z]) => [x, y, z, null]));
            return;
        }

        if(operation.type === "terrain") { this.setTerrain(operation, messages); }
        if(operation.type === "cubes") { this.placeCubes(operation.cells, step, refused); }
        if(operation.type === "ages") { this.paintAges(operation.columns, step, messages); }
        if(operation.type === "add") { props.push(operation.placement); }
        if(operation.type === "copy" && prop) { this.copy(prop, operation.by ?? [0, 0, 0], messages); }
        if(operation.type === "move" && prop) { this.move(prop, operation, messages); }
        if(operation.type === "delete" && prop && operation.part === undefined) { props.splice(operation.prop, 1); }
        if(operation.type === "delete" && prop && operation.part !== undefined) { prop.parts = { ...prop.parts, [operation.part]: null }; }
        if(operation.type === "resetParts" && prop) { delete prop.parts; }
        if(operation.type === "applyToAll" && prop?.parts) { this.applyToAll(prop); }
        if(operation.type === "breakApart" && prop) { this.breakApart(operation.prop, step, messages); }
    }

    // A placement is the zone's prop; a part is an object a building places.
    move(prop, { part, by = [0, 0, 0], turns = 0 }, messages)
    {
        const [dx, dy, dz] = by.map((cubes) => cubes / CUBES);

        if(part !== undefined)
        {
            this.movePart(prop, part, [dx, dy, dz], turns);
            return;
        }

        if(prop.run)
        {
            if(dy !== 0 || turns !== 0) { messages.push("A run moves only across the ground."); }

            prop.points = prop.points.map(([x, z]) => [onGrid(x + dx), onGrid(z + dz)]);
            return;
        }

        prop.x = onGrid(prop.x + dx);
        prop.z = onGrid(prop.z + dz);

        if(dy !== 0) { prop.y = onGrid(this.heightOf(prop) + dy); }
        if(dy !== 0 && prop.object) { delete prop.on; }
        if(turns !== 0) { prop.angle = turned(prop.angle, turns); }
    }

    // The height a placement stands at now, in metres.
    heightOf(prop)
    {
        if(prop.y !== undefined) { return prop.y; }

        const index = this.zone.props.indexOf(prop);
        const placed = this.index.objects.find((entry) => entry.prop === index && entry.part === undefined);

        if(prop.object) { return placed?.y ?? 0; }

        return Voxelise.standingHeight(prop, this.context.prefabs[prop.prefab], Terrain.heightsOf(this.zone, this.terrain.surfaces));
    }

    // A part moves in its building's frame, so it moves with the building.
    movePart(prop, part, [dx, dy, dz], turns)
    {
        const prefab = this.context.prefabs[prop.prefab];
        const base = Object.assign({ ...prefab.objects[part] }, prefab.layout?.[part], prop.parts?.[part]);
        const angle = Voxelise.quarterTurn(prop.angle ?? 0);
        const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
        const at = [base.at[0] + dx * cos - dz * sin, base.at[1] + dy, base.at[2] + dx * sin + dz * cos].map(onGrid);
        const change = { ...prop.parts?.[part], at };

        if(turns !== 0) { change.angle = turned(base.angle, turns); }
        if(dy !== 0) { change.on = null; }

        prop.parts = { ...prop.parts, [part]: change };
    }

    // A copy leaves out the placement's id, which must stay unique.
    copy(prop, by, messages)
    {
        const copied = without(structuredClone(prop), ["id"]);

        this.zone.props.push(copied);
        this.move(copied, { by }, messages);
    }

    applyToAll(prop)
    {
        this.setLayouts({ ...this.layouts, [prop.prefab]: { ...this.layouts[prop.prefab], ...prop.parts } });
        delete prop.parts;
    }

    // The placement's cubes join the terrain, and its objects become the
    // zone's own placements.
    breakApart(index, step, messages)
    {
        const prop = this.zone.props[index];
        const prefab = this.context.prefabs[prop.prefab];

        if(!prefab)
        {
            messages.push("Only a prefab breaks apart.");
            return;
        }

        const problems = [];
        const standing = { ...prop, index, y: this.heightOf(prop) };
        const terrainTop = (column, row) => this.terrain.surfaces[row * this.zone.columns + column];
        const placed = Voxelise.zoneCells(this.zone, [standing], [], this.context.prefabs, this.numbers, "Prop " + index, problems, terrainTop);
        const columns = this.zone.columns;

        for(const [cell, block] of placed.cells)
        {
            const [x, y, z] = [cell % columns, Math.floor(cell / (columns * columns)), Math.floor(cell / columns) % columns];

            step.cells.push([x, y, z, this.blockAt(x, y, z), block]);
            this.setCell(x, y, z, block);
        }

        const parts = this.index.objects.filter((entry) => entry.prop === index && entry.part !== undefined);
        const objects = parts.map(({ object, x, y, z, turns, id, mover, trigger }) =>
        {
            const own = { object, x: round(x), z: round(z), y: round(y), angle: round(turns * QUARTER) };

            return { ...own, ...(id ? { id } : {}), ...(mover ? { mover } : {}), ...(trigger ? { trigger } : {}) };
        });

        this.pinObjectsIn(index);
        this.zone.props.splice(index, 1, ...objects);
        messages.push(...problems);
    }

    // An object placed without a height stands on the floor or the top that
    // the bake finds above the terrain's surface. Once a building's cubes join
    // the terrain, that search starts at the roof, so each object standing in
    // the building keeps the height it has now.
    pinObjectsIn(index)
    {
        const [x0, , z0, x1, , z1] = this.index.objects.find((entry) => entry.prop === index && entry.part === undefined).box;

        for(const entry of this.index.objects)
        {
            const prop = this.zone.props[entry.prop];
            const [left, , back, right, , front] = entry.box;
            const isWithin = left <= x1 && right >= x0 && back <= z1 && front >= z0;

            if(!isWithin || entry.prop === index || entry.part !== undefined || !prop.object) { continue; }

            prop.y = round(entry.y);
            delete prop.on;
        }
    }

    /* TERRAIN ****************************************************************/

    // `water` is the level in metres above the zone's base cell.
    setTerrain({ recipe, water }, messages)
    {
        const problems = this.isLocked ? ["The terrain is locked in, so its recipe cannot change."] : this.checkTerrain(recipe, water);

        if(problems.length > 0)
        {
            messages.push(...problems);
            return;
        }

        this.zone.terrain = structuredClone(recipe);
        this.zone.water = this.zone.base + Math.round(water * CUBES);
    }

    checkTerrain(recipe, water)
    {
        const problems = Recipe.check(recipe, this.zone.columns / CUBES);
        const { min, max } = Recipe.WATER;

        if(!(Number.isFinite(water) && water >= min && water <= max)) { problems.push("The water level needs to be a number from " + min + " to " + max + "."); }

        return problems;
    }

    // An overhead map of a recipe, without changing the zone.
    map(recipe, water)
    {
        const problems = this.checkTerrain(recipe, water);

        if(problems.length > 0) { throw new Error(problems.join(" ")); }

        return { map: TerrainMap.render({ ...this.zone, water: this.zone.base + Math.round(water * CUBES) }, recipe) };
    }

    // Runs the recipe again when it or the water level changed since it last
    // ran, and says whether it did.
    syncTerrain(messages)
    {
        const key = JSON.stringify([this.zone.terrain, this.zone.water]);

        if(this.isLocked || key === this.generatedFrom) { return false; }

        const problems = [];

        this.terrain = Terrain.generateColumns(this.zone, "The terrain", problems);

        if(problems.length > 0) { throw new Error(problems.join("\n")); }
        if(this.terrain.clipped > 0) { messages.push(this.terrain.clipped + " columns rise above the zone's height of " + this.zone.height + " cubes and are cut flat."); }

        this.generatedFrom = key;

        return true;
    }

    // Writes the terrain as locked cubes, then saves the rest of the zone, and
    // returns the paths written. The recipe goes, and cannot be run again.
    async lockIn()
    {
        if(this.isLocked) { throw new Error("The terrain of " + this.id + " is already locked in."); }

        const where = "Zone zones/" + this.id;
        const problems = [];
        const ground = Zones.groundOf(this.zone, this.context, where, problems);
        const files = Terrain.lockedFiles(this.zone, this.terrain, ground, this.numbers, this.context.blocks.map((block) => block.id));
        const lockedFolder = path.join(this.folder, Terrain.LOCKED_FOLDER);

        fs.mkdirSync(lockedFolder, { recursive: true });

        for(const file of files) { fs.writeFileSync(path.join(lockedFolder, file.path), file.bytes); }

        delete this.zone.terrain;
        this.terrain = Terrain.readLocked(this.folder, this.zone, this.numbers, where, problems);
        this.generatedFrom = null;

        if(problems.length > 0) { throw new Error(problems.join("\n")); }

        const written = [...files.map((file) => path.relative(this.contentRoot, path.join(lockedFolder, file.path)).replaceAll("\\", "/")), ...this.save()];

        await this.bake(null);

        return written;
    }

    /* CUBES ******************************************************************/

    placeCubes(cells, step, refused)
    {
        const columns = this.zone.columns;

        for(const [x, y, z, block] of cells)
        {
            const isInside = x >= 0 && z >= 0 && y >= 0 && x < columns && z < columns && y < this.zone.height;

            if(!isInside || this.placed.has((y * columns + z) * columns + x) || !(block === 0 || this.context.blocks[block - 1]))
            {
                refused.push([x, y, z, isInside ? this.ownerOf(x, y, z) : null]);
                continue;
            }

            const old = this.blockAt(x, y, z);

            if(old === block) { continue; }

            step.cells.push([x, y, z, old, block]);
            this.setCell(x, y, z, block);
        }
    }

    // `columns` holds [column, row, age]; a locked region keeps a painted age
    // as the age plus one.
    paintAges(columns, step, messages)
    {
        const size = this.zone.columns;
        let refused = 0;

        for(const [column, row, age] of columns)
        {
            const isValid = [column, row, age].every(Number.isInteger) && column >= 0 && row >= 0 && column < size && row < size && age >= 0 && age <= MAX_AGE;

            if(!isValid)
            {
                refused++;
                continue;
            }

            const old = this.ageAt(column, row);

            if(old === age + 1) { continue; }

            step.ages.push([column, row, old, age + 1]);
            this.setAge(column, row, age + 1);
        }

        if(refused > 0) { messages.push(refused + " ages were outside the zone or not whole numbers from 0 to " + MAX_AGE + "."); }
    }

    ageAt(column, row)
    {
        const region = this.terrain.locked.get(Math.floor(column / REGION) + "-" + Math.floor(row / REGION));

        return region.ages[(row % REGION) * region.width + (column % REGION)];
    }

    setAge(column, row, painted)
    {
        const name = Math.floor(column / REGION) + "-" + Math.floor(row / REGION);
        const region = this.terrain.locked.get(name);

        region.ages[(row % REGION) * region.width + (column % REGION)] = painted;
        this.editedRegions.add(name);
    }

    // The index in the zone's placed objects of the placement that owns a
    // cell, or null for the terrain's own cells.
    ownerOf(x, y, z)
    {
        const columns = this.zone.columns;

        return this.placed.owners?.get((y * columns + z) * columns + x) ?? null;
    }

    chunkOf(x, y, z, isCreating)
    {
        const name = Math.floor(x / REGION) + "-" + Math.floor(z / REGION);
        const region = this.terrain.locked.get(name);

        if(!this.chunkMaps.has(name)) { this.chunkMaps.set(name, new Map(region.chunks.map((chunk) => [chunk.x + "," + chunk.y + "," + chunk.z, chunk]))); }

        const [cx, cy, cz] = [Math.floor((x % REGION) / CHUNK), Math.floor(y / CHUNK), Math.floor((z % REGION) / CHUNK)];
        const key = cx + "," + cy + "," + cz;
        const chunks = this.chunkMaps.get(name);

        if(!chunks.has(key) && isCreating)
        {
            const chunk = { x: cx, y: cy, z: cz, uniform: null, cells: new Uint8Array(CELLS) };

            region.chunks.push(chunk);
            chunks.set(key, chunk);
        }

        return { name, region, chunk: chunks.get(key) ?? null };
    }

    blockAt(x, y, z)
    {
        const { chunk } = this.chunkOf(x, y, z, false);

        return chunk ? chunk.cells[((y % CHUNK) * CHUNK + (z % CHUNK)) * CHUNK + (x % CHUNK)] : 0;
    }

    setCell(x, y, z, block)
    {
        const { name, chunk } = this.chunkOf(x, y, z, true);

        chunk.cells[((y % CHUNK) * CHUNK + (z % CHUNK)) * CHUNK + (x % CHUNK)] = block;
        this.editedRegions.add(name);
        this.unsettled.add(z * this.zone.columns + x);
    }

    // Each column whose cells changed takes its surface again.
    settleSurfaces()
    {
        for(const column of this.unsettled)
        {
            const [x, z] = [column % this.zone.columns, Math.floor(column / this.zone.columns)];
            const { region } = this.chunkOf(x, 0, z, false);
            let surface = this.zone.height;

            while(surface > 0 && !this.isFloor(this.blockAt(x, surface - 1, z))) { surface--; }

            region.surfaces[(z % REGION) * region.width + (x % REGION)] = surface;
            this.terrain.surfaces[column] = surface;
        }

        this.unsettled.clear();
    }

    isFloor(block)
    {
        return block !== 0 && this.context.blocks[block - 1].kind !== "liquid";
    }

    /* CAPTURE ****************************************************************/

    // Copies the cubes in `box`, [x0, y0, z0, x1, y1, z1] in cells, to a new
    // prefab or object `id` in content/, as data, trimmed to the cubes it
    // holds. A placement's cubes are copied too, but then the cubes stay, as
    // `replace` gives way to the new piece only for the zone's own cubes.
    async capture({ box, id, as, replace })
    {
        const messages = [];

        this.checkCapture(box, id, as);

        const cells = this.cubesIn(box);

        if(cells.length === 0) { throw new Error("The box holds no cubes to capture."); }

        const low = [0, 1, 2].map((axis) => Math.min(...cells.map((cell) => cell[axis])));
        const size = [0, 1, 2].map((axis) => Math.max(...cells.map((cell) => cell[axis])) - low[axis] + 1);

        if(size.some((count) => count > MAX_CAPTURE[as])) { throw new Error("A captured " + as + " is at most " + MAX_CAPTURE[as] + " cubes a side; this one is " + size.join(" × ") + "."); }

        const data = as === "prefab" ? this.prefabData(cells, low, size) : this.objectData(cells, low, size);
        const file = path.join(this.contentRoot, CAPTURED[as], id + ".json");
        const blocks = new Map(this.context.blocks.map((block) => [block.id, block]));
        const problems = [];
        const baked = as === "prefab" ? Props.fromCells(data, blocks, "Prefab " + id, problems) : Objects.bakeData(id, data, blocks, "Object " + id, problems);

        if(!baked) { throw new Error(problems.join("\n")); }

        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, JSON.stringify(data) + "\n");
        this.context[CAPTURED[as]][id] = baked;

        const written = [path.relative(this.contentRoot, file).replaceAll("\\", "/")];
        const owner = cells.map(([x, y, z]) => this.ownerOf(x, y, z)).find((index) => index !== null);

        if(replace && owner !== undefined) { messages.push("Some cubes belong to " + (this.index.objects[owner]?.name ?? "a placement") + ", so the cubes stay where they are."); }

        if(!replace || owner !== undefined) { return { written, regions: [], messages, ...this.state }; }

        const answer = await this.apply([{ type: "cubes", cells: cells.map(([x, y, z]) => [x, y, z, 0]) }, { type: "add", placement: this.placementOf(as, id, low, size) }]);

        return { ...answer, written, messages: [...messages, ...answer.messages] };
    }

    checkCapture(box, id, as)
    {
        const size = [this.zone.columns, this.zone.height, this.zone.columns];
        const isBox = Array.isArray(box) && box.length === 6 && box.every(Number.isInteger) && [0, 1, 2].every((axis) => box[axis] >= 0 && box[axis] <= box[axis + 3] && box[axis + 3] < size[axis]);

        if(!CAPTURED[as]) { throw new Error("Capture as a prefab or an object."); }
        if(!ID_PATTERN.test(id ?? "")) { throw new Error("The name needs to start with a lower-case letter and hold only letters and digits."); }
        if(this.context.prefabs[id] || this.context.objects[id]) { throw new Error("A prefab or object called " + id + " exists already."); }
        if(!isBox) { throw new Error("The capture box needs two corners inside the zone."); }
    }

    // Each cube in the box as [x, y, z, block id], from the placements' cells
    // where they have them; water and the hidden blocks of objects are left
    // out.
    cubesIn([x0, y0, z0, x1, y1, z1])
    {
        const columns = this.zone.columns;
        const cubes = [];

        for(let y = y0; y <= y1; y++)
        {
            for(let z = z0; z <= z1; z++)
            {
                for(let x = x0; x <= x1; x++)
                {
                    const index = (y * columns + z) * columns + x;
                    const number = this.placed.has(index) ? this.placed.get(index) : this.blockAt(x, y, z);
                    const block = number > 0 ? this.context.blocks[number - 1] : null;

                    if(block && block.kind !== "liquid" && block.kind !== "object") { cubes.push([x, y, z, block.id]); }
                }
            }
        }

        return cubes;
    }

    prefabData(cells, low, size)
    {
        const palette = [null, ...new Set(cells.map((cell) => cell[3]))];
        const data = new Uint8Array(size[0] * size[1] * size[2]);

        for(const [x, y, z, id] of cells) { data[((y - low[1]) * size[2] + z - low[2]) * size[0] + x - low[0]] = palette.indexOf(id); }

        return { cells: size, palette, runs: FineMesher.encode(data) };
    }

    // Each cube becomes FINE by FINE by FINE fine cubes of its block.
    objectData(cells, low, size)
    {
        const fine = FineMesher.FINE;
        const palette = [null, ...new Set(cells.map((cell) => cell[3]))];
        const [width, , depth] = size.map((count) => count * fine);
        const data = new Uint8Array(width * size[1] * fine * depth);

        for(const [x, y, z, id] of cells)
        {
            for(let fy = 0; fy < fine; fy++)
            {
                for(let fz = 0; fz < fine; fz++)
                {
                    const start = (((y - low[1]) * fine + fy) * depth + (z - low[2]) * fine + fz) * width + (x - low[0]) * fine;

                    data.fill(palette.indexOf(id), start, start + fine);
                }
            }
        }

        return { cells: size, isSolid: true, palette, runs: FineMesher.encode(data) };
    }

    // A captured prefab's origin is the cube corner nearest the middle of its
    // bottom; an object's position is the middle of its footprint.
    placementOf(as, id, [x0, y0, z0], [width, , depth])
    {
        const half = this.zone.columns / CUBES / 2;
        const y = round((y0 - this.zone.base) / CUBES);

        if(as === "object") { return { object: id, x: round((x0 + width / 2) / CUBES - half), z: round((z0 + depth / 2) / CUBES - half), y, angle: 0 }; }

        return { prefab: id, x: round((x0 + Math.floor(width / 2)) / CUBES - half), z: round((z0 + Math.floor(depth / 2)) / CUBES - half), y, angle: 0 };
    }

    /* OBJECTS ****************************************************************/

    // Writes an object's data, as the bench saves it, to content/objects/ for
    // every zone's copies, and bakes the zone again, as the cells the object
    // fills may have changed.
    async saveObject({ id, object })
    {
        const problems = [];
        const blocks = new Map(this.context.blocks.map((block) => [block.id, block]));

        if(!ID_PATTERN.test(id ?? "")) { throw new Error("The object needs a name that starts with a lower-case letter and holds only letters and digits."); }

        const baked = Objects.bakeData(id, object ?? {}, blocks, "Object " + id, problems);

        if(!baked) { throw new Error(problems.join(". ")); }

        const file = path.join(this.contentRoot, CAPTURED.object, id + ".json");

        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, JSON.stringify(baked) + String.fromCharCode(10));
        this.context.objects[id] = baked;

        return { written: [path.relative(this.contentRoot, file).split(path.sep).join("/")], regions: await this.bake(null), messages: [], ...this.state };
    }

    /* BAKE *******************************************************************/

    // A step that changed the recipe bakes every region.
    async bakeStep(step, messages)
    {
        return this.bake(this.syncTerrain(messages) ? null : step);
    }

    // Bakes the regions the step touched, or every region without a step, and
    // returns the names of those baked.
    async bake(step)
    {
        const problems = [];
        const before = this.index?.objects ?? [];
        const only = step ? (objects) => this.touched(step, before, objects) : null;
        const baked = await Zones.bakeZone(this.zone, this.folder, this.people, this.context, "Zone zones/" + this.id, problems, { terrain: this.terrain, only, level: LEVEL });

        if(!baked) { throw new Error(problems.join("\n")); }

        this.index = baked.index;
        this.placed = baked.placed;
        this.files.set("index.json", Buffer.from(JSON.stringify(baked.index) + "\n"));

        for(const region of baked.regions) { this.files.set(region.name + ".bin", region.bytes); }

        return baked.regions.map((region) => region.name);
    }

    // The regions under the step's cells and under every placed object that
    // changed, appeared or went.
    touched(step, before, after)
    {
        const names = new Set([...step.cells, ...step.ages.map(([x, z]) => [x, 0, z])].map(([x, , z]) => Math.floor(x / REGION) + "-" + Math.floor(z / REGION)));
        const key = (entry) => JSON.stringify(without(entry, ["prop", "id", "trigger"]));
        const counts = new Map();

        for(const entry of before) { counts.set(key(entry), (counts.get(key(entry)) ?? 0) + 1); }
        for(const entry of after) { counts.set(key(entry), (counts.get(key(entry)) ?? 0) - 1); }

        for(const [entry, count] of counts)
        {
            if(count === 0) { continue; }

            const [x0, , z0, x1, , z1] = JSON.parse(entry).box;

            for(let rz = Math.floor(z0 / REGION); rz <= Math.floor(z1 / REGION); rz++)
            {
                for(let rx = Math.floor(x0 / REGION); rx <= Math.floor(x1 / REGION); rx++) { names.add(rx + "-" + rz); }
            }
        }

        return names;
    }

    /* SAVE *******************************************************************/

    // Writes the zone file, the edited locked regions and the layouts, and
    // returns the paths written, relative to content/. Every region is written
    // when the bake numbers blocks differently from the locked palette.
    save()
    {
        const ids = this.context.blocks.map((block) => block.id);
        const lockedFolder = path.join(this.folder, Terrain.LOCKED_FOLDER);
        const palettePath = path.join(lockedFolder, Terrain.PALETTE_FILE);
        const isRenumbered = this.isLocked && fs.readFileSync(palettePath, "utf8") !== JSON.stringify(ids, null, 4) + "\n";
        const regions = isRenumbered ? [...this.terrain.locked.keys()] : [...this.editedRegions];
        const written = [];
        const write = (file, bytes) =>
        {
            fs.writeFileSync(file, bytes);
            written.push(path.relative(this.contentRoot, file).replaceAll("\\", "/"));
        };

        fs.mkdirSync(this.folder, { recursive: true });
        write(path.join(this.folder, "zone.json"), JSON.stringify(this.zone, null, 4) + "\n");

        for(const name of regions)
        {
            const region = this.terrain.locked.get(name);
            const encoded = RegionCodec.encode({ ...region, grounds: region.surfaces });

            write(path.join(lockedFolder, name + ".bin"), zlib.deflateSync(encoded, { level: 9 }));
        }

        if(isRenumbered) { write(palettePath, JSON.stringify(ids, null, 4) + "\n"); }
        if(JSON.stringify(this.layouts) !== this.savedLayouts) { write(path.join(this.contentRoot, LAYOUTS), JSON.stringify(this.layouts, null, 4) + "\n"); }

        this.history = [];
        this.future = [];
        this.editedRegions.clear();
        this.savedLayouts = JSON.stringify(this.layouts);

        return written;
    }
}

function without(object, keys)
{
    return Object.fromEntries(Object.entries(object).filter(([key]) => !keys.includes(key)));
}

function round(value)
{
    return Math.round(value * PRECISION) / PRECISION;
}

// Placements stand on whole or half cubes: a footprint an odd number of
// cubes wide has its middle in a cube's middle.
function onGrid(metres)
{
    return round(Math.round(metres * CUBES * 2) / (CUBES * 2));
}

// Placements turn in quarter turns, so an angle snaps before it turns.
function turned(angle = 0, turns)
{
    const quarters = (((Math.round(angle / QUARTER) + turns) % 4) + 4) % 4;

    return round(quarters * QUARTER);
}
