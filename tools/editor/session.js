import * as Blocks from "../bake/blocks.js";
import * as Objects from "../bake/objects.js";
import * as Props from "../bake/props.js";
import * as RegionCodec from "../../js/sim/region-codec.js";
import * as Terrain from "../bake/terrain.js";
import * as Voxelise from "../bake/voxelise.js";
import * as WorldTextures from "../bake/world-textures.js";
import * as Zones from "../bake/zones.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

const { CHUNK, CELLS, REGION } = RegionCodec;
const CUBES = Terrain.CUBES_PER_METRE;
const QUARTER = Math.PI / 2;
const PRECISION = 1e6;
const LEVEL = 1;
const LAYOUTS = path.join("props", "layouts.json");


/******************************************************************************/
/* EDIT SESSION                                                               */
/******************************************************************************/

// Each `apply` is one step that `undo` reverses. Nothing reaches content/
// until `save`.
export class EditSession
{
    static async open(id, contentRoot)
    {
        const problems = [];
        const context = {};

        for(const baker of [WorldTextures, Blocks, Props, Objects]) { await baker.bake(problems, context); }

        const folder = path.join(contentRoot, "zones", id);
        const zone = JSON.parse(fs.readFileSync(path.join(folder, "zone.json"), "utf8"));
        const numbers = Object.fromEntries(context.blocks.map((block, i) => [block.id, i + 1]));

        if(!Terrain.isLocked(folder)) { problems.push("Zone zones/" + id + " has no locked terrain to edit. Run node tools/lock-terrain.js " + id); }
        if(problems.length > 0) { throw new Error(problems.join("\n")); }

        const terrain = Terrain.readLocked(folder, zone, numbers, "Zone zones/" + id, problems);
        const layoutsPath = path.join(contentRoot, LAYOUTS);
        const layouts = fs.existsSync(layoutsPath) ? JSON.parse(fs.readFileSync(layoutsPath, "utf8")) : {};
        const session = new EditSession({ id, folder, contentRoot, zone, terrain, context, layouts, people: await Zones.loadPeople() });

        if(problems.length > 0) { throw new Error(problems.join("\n")); }

        session.setLayouts(layouts);
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
    }

    get state()
    {
        return { isDirty: this.history.length > 0, canUndo: this.history.length > 0, canRedo: this.future.length > 0, steps: this.history.length };
    }

    // The baked file at `name`, a path inside the zone's asset folder, or null.
    file(name)
    {
        return this.files.get(name) ?? null;
    }

    /* STEPS ******************************************************************/

    // Applies a list of operations as one step. Cells that belong to a
    // placement are refused, and named in `refused`.
    async apply(operations)
    {
        const before = this.snapshot();
        const step = { zone: [before.zone, null], layouts: [before.layouts, null], cells: [] };
        const refused = [];
        const messages = [];

        for(const operation of operations) { this.operate(operation, step, refused, messages); }

        this.settleSurfaces();
        step.zone[1] = JSON.stringify(this.zone);
        step.layouts[1] = JSON.stringify(this.layouts);

        const isChanged = step.cells.length > 0 || step.zone[0] !== step.zone[1] || step.layouts[0] !== step.layouts[1];

        if(isChanged)
        {
            this.history.push(step);
            this.future = [];
        }

        if(!isChanged) { return { regions: [], refused, messages, ...this.state }; }

        try
        {
            return { regions: await this.bake(step), refused, messages, ...this.state };
        }
        catch(error)
        {
            this.history.pop();
            this.restore(step, 0);
            await this.bake(step);

            throw error;
        }
    }

    async undo()
    {
        const step = this.history.pop();

        if(!step) { return { regions: [], ...this.state }; }

        this.restore(step, 0);
        this.future.push(step);

        return { regions: await this.bake(step), ...this.state };
    }

    async redo()
    {
        const step = this.future.pop();

        if(!step) { return { regions: [], ...this.state }; }

        this.restore(step, 1);
        this.history.push(step);

        return { regions: await this.bake(step), ...this.state };
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

        if(operation.type === "cubes") { this.placeCubes(operation.cells, step, refused); }
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

    /* BAKE *******************************************************************/

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
        const names = new Set(step.cells.map(([x, , z]) => Math.floor(x / REGION) + "-" + Math.floor(z / REGION)));
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
        const isRenumbered = fs.readFileSync(palettePath, "utf8") !== JSON.stringify(ids, null, 4) + "\n";
        const regions = isRenumbered ? [...this.terrain.locked.keys()] : [...this.editedRegions];
        const written = [];
        const write = (file, bytes) =>
        {
            fs.writeFileSync(file, bytes);
            written.push(path.relative(this.contentRoot, file).replaceAll("\\", "/"));
        };

        write(path.join(this.folder, "zone.json"), JSON.stringify(this.zone, null, 4) + "\n");

        for(const name of regions)
        {
            const region = this.terrain.locked.get(name);
            const encoded = RegionCodec.encode({ ...region, grounds: region.surfaces, ages: new Uint8Array(region.width * region.depth) });

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
