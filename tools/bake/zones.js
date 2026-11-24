import * as Archetypes from "../../content/archetypes.js";
import * as Prefabs from "../../content/props/prefabs.js";
import * as PropBaker from "./props.js";
import * as Terrain from "./terrain.js";
import * as Voxelise from "./voxelise.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

const CONTENT = path.resolve(import.meta.dirname, "..", "..", "content");
const ID_PATTERN = /^[a-z][A-Za-z0-9]*$/;
const COLOUR_PATTERN = /^#[0-9a-f]{6}$/;


/******************************************************************************/
/* BAKE                                                                       */
/******************************************************************************/

export async function bake(problems, context)
{
    const people = await loadPeople();
    const files = [{ path: "npcs.json", bytes: Buffer.from(JSON.stringify(people, null, 4) + "\n") }];
    const ids = [];

    for(const id of fs.readdirSync(path.join(CONTENT, "zones")).filter((name) => fs.existsSync(path.join(CONTENT, "zones", name, "zone.json"))).sort())
    {
        const folder = path.join(CONTENT, "zones", id);
        const zone = JSON.parse(fs.readFileSync(path.join(folder, "zone.json"), "utf8"));
        const where = "Zone zones/" + id;

        if(zone.id !== id) { problems.push(where + " has the id " + zone.id + ", not its folder's name"); continue; }

        const baked = await bakeZone(zone, folder, people, context, where, problems);

        if(!baked) { continue; }

        ids.push(zone.id);
        files.push({ path: "zones/" + zone.id + "/index.json", bytes: Buffer.from(JSON.stringify(baked.index) + "\n") });

        for(const region of baked.regions) { files.push({ path: "zones/" + zone.id + "/" + region.name + ".bin", bytes: region.bytes }); }
    }

    files.push({ path: "zones/index.json", bytes: Buffer.from(JSON.stringify(ids, null, 4) + "\n") });

    return { files, ids: { zone: ids, npc: Object.keys(people.npcs) } };
}

export async function loadPeople()
{
    const people = { npcs: {}, lines: {} };

    for(const file of fs.readdirSync(path.join(CONTENT, "npcs")).filter((name) => name.endsWith(".js")).sort())
    {
        const loaded = await import(url.pathToFileURL(path.join(CONTENT, "npcs", file)).href);

        Object.assign(people.npcs, loaded.NPCS ?? {});
        Object.assign(people.lines, loaded.LINES ?? {});
    }

    return people;
}


/******************************************************************************/
/* ZONES                                                                      */
/******************************************************************************/

// `options.terrain` replaces the terrain read from the folder,
// `options.only(objects)` names the regions to compose, from the placed
// objects, and `options.level` is the deflate level of the region files.
export async function bakeZone(zone, folder, people, context, where, problems, options = {})
{
    const before = problems.length;

    if(!ID_PATTERN.test(zone.id ?? "")) { problems.push(where + " has an invalid id: " + zone.id); }

    checkShape(zone, where, problems);

    if(problems.length > before) { return null; }

    const isLocked = Terrain.isLocked(folder);
    const ground = isLocked ? [] : groundOf(zone, context, where, problems);

    checkLighting(zone.lighting, where, problems);
    checkPeople(zone, people, where, problems);

    const half = zone.columns / Terrain.CUBES_PER_METRE / 2;

    if(!(Math.abs(zone.spawn?.x) < half && Math.abs(zone.spawn?.z) < half)) { problems.push(where + " needs a spawn point inside the zone"); }
    if(zone.welcome !== undefined && !(Array.isArray(zone.welcome) && zone.welcome.every((line) => typeof line === "string"))) { problems.push(where + " needs its welcome to be a list of lines"); }
    if(zone.weathering !== undefined && !isAge(zone.weathering.age)) { problems.push(where + " needs its weathering age to be a whole number from 0 to 100"); }
    if(problems.length > before) { return null; }

    const numbers = Object.fromEntries(context.blocks.map((block, i) => [block.id, i + 1]));

    if(isLocked && (fs.existsSync(path.join(folder, "terrain.js")) || fs.existsSync(path.join(folder, "terrain")))) { problems.push(where + " has locked cubes and a terrain source; delete the terrain source"); }

    const terrain = options.terrain ?? (isLocked ? Terrain.readLocked(folder, zone, numbers, where, problems) : await Terrain.readColumns(folder, zone, where, problems));

    if(problems.length > before) { return null; }

    const heightAt = Terrain.heightsOf(zone, terrain.surfaces);
    const runs = [];
    const props = [];
    const objects = [];

    for(const [i, prop] of (zone.props ?? []).entries())
    {
        if(prop.run)
        {
            if(!Prefabs.RUNS[prop.run]) { problems.push(where + " prop " + i + " is an unknown run: " + prop.run); continue; }

            const run = PropBaker.record(Prefabs.RUNS[prop.run], prop.points, heightAt);

            PropBaker.checkFaces(run.blocks, context.worldTextures, where + " run " + i, problems);
            runs.push({ ...run, index: i, name: prop.run, points: prop.points });
            continue;
        }

        if(prop.object)
        {
            if(!context.objects[prop.object]) { problems.push(where + " prop " + i + " is an unknown object: " + prop.object); continue; }
            if(!(Math.abs(prop.x) < half && Math.abs(prop.z) < half)) { problems.push(where + " prop " + i + " is outside the zone"); }
            if(prop.on !== undefined && prop.on !== "top" && prop.on !== "ceiling") { problems.push(where + " prop " + i + " has an unknown on: " + prop.on); }

            objects.push({ ...prop, index: i });
            continue;
        }

        if(!context.prefabs[prop.prefab]) { problems.push(where + " prop " + i + " is an unknown prefab: " + prop.prefab); continue; }
        if(!(Math.abs(prop.x) < half && Math.abs(prop.z) < half)) { problems.push(where + " prop " + i + " is outside the zone"); }
        if(prop.age !== undefined && !isAge(prop.age)) { problems.push(where + " prop " + i + " needs an age that is a whole number from 0 to 100"); }

        if(prop.y !== undefined && !Number.isFinite(prop.y)) { problems.push(where + " prop " + i + " needs a height in metres"); }
        if(prop.parts !== undefined && !Voxelise.areParts(prop.parts)) { problems.push(where + " prop " + i + " needs parts that map a part number to null or { at, angle, on }"); }

        props.push({ ...prop, index: i, y: prop.y ?? Voxelise.standingHeight(prop, context.prefabs[prop.prefab], heightAt) });
        objects.push(...Voxelise.prefabObjects(props.at(-1), context.prefabs[prop.prefab]));
    }

    checkMotion(objects, context.objects, where, problems);

    if(problems.length > before) { return null; }

    const terrainTop = (column, row) => terrain.surfaces[row * zone.columns + column];
    const placed = Voxelise.zoneCells(zone, props, runs, context.prefabs, numbers, where, problems, terrainTop);

    placed.objects.push(...Voxelise.placeObjects(placed.cells, zone, objects, context.objects, numbers, terrainTop, placed.objects.length));

    if(problems.length > before) { return null; }

    const solid = new Set(context.blocks.flatMap((block, i) => (block.kind === "liquid" ? [] : [i + 1])));
    const only = options.only?.(placed.objects) ?? null;
    const regions = Terrain.bakeRegions(zone, terrain, ground, numbers, { cells: placed.cells, solid }, agesOf(zone, props, placed.objects), { only, level: options.level });
    const { id, name, welcome, columns, height, base, water, lighting, spawn } = zone;
    const index = { id, name, welcome, columns, height, base, water, lighting, spawn, people: zone.people, objects: placed.objects, regions: Terrain.regionNames(zone.columns) };

    return { index, regions, placed: placed.cells };
}

function checkShape(zone, where, problems)
{
    const { columns, height, base, water } = zone;
    const isWhole = (value, low, high) => Number.isInteger(value) && value >= low && value <= high;

    if(!(isWhole(columns, 32, 65535) && columns % 32 === 0)) { problems.push(where + " needs a whole multiple of 32 columns"); }
    if(!(isWhole(height, 32, 256) && height % 32 === 0)) { problems.push(where + " needs a height of 32 to 256 cells, a whole multiple of 32"); }
    if(!isWhole(base, 0, height - 1)) { problems.push(where + " needs a base cell inside its height"); }
    if(!isWhole(water, 0, height)) { problems.push(where + " needs a water cell inside its height"); }
}

export function groundOf(zone, context, where, problems)
{
    const solid = new Set(context.blocks.filter((block) => block.kind === "solid").map((block) => block.id));
    const numbers = Object.fromEntries(context.blocks.map((block, i) => [block.id, i + 1]));

    if(!(Array.isArray(zone.ground) && zone.ground.length > 0)) { problems.push(where + " needs a list of ground layers"); return []; }

    for(const block of ["rock", "water"]) { if(!numbers[block]) { problems.push(where + " needs the " + block + " block"); } }

    return zone.ground.map((layers, i) =>
    {
        for(const block of [layers.top, layers.under])
        {
            if(!solid.has(block)) { problems.push(where + " ground " + i + " needs a solid block, not " + block); }
        }

        return { top: numbers[layers.top], under: numbers[layers.under] };
    });
}

const AXES = ["x", "y", "z"];

function isPositive(value)
{
    return Number.isFinite(value) && value > 0;
}

// A solid object turns only by quarter turns, so its cells stay on the grid.
function checkMotion(objects, baked, where, problems)
{
    const ids = new Set();

    for(const object of objects)
    {
        const at = where + " prop " + object.index;
        const { mover, trigger } = object;

        if(object.id !== undefined && !(ID_PATTERN.test(object.id) && !ids.has(object.id))) { problems.push(at + " needs an id that is valid and not used before"); }

        ids.add(object.id);

        if(mover !== undefined)
        {
            const tracks = ["slide", "turn", "spin"].filter((track) => mover[track] !== undefined);
            const turn = mover.turn;
            const isQuarter = (degrees) => Number.isInteger((degrees ?? 0) / 90);

            if(tracks.length !== 1) { problems.push(at + " needs one track: slide, turn or spin"); }
            if(mover.slide !== undefined && !(Array.isArray(mover.slide) && mover.slide.length === 3 && mover.slide.every(Number.isInteger))) { problems.push(at + " needs a slide of three whole numbers of cubes"); }
            if(turn !== undefined && !(AXES.includes(turn.axis) && Array.isArray(turn.pivot) && turn.pivot.length === 3 && turn.pivot.every(Number.isFinite) && Number.isFinite(turn.degrees) && turn.degrees !== 0)) { problems.push(at + " needs a turn of { axis, pivot, degrees, from }"); }
            if(turn !== undefined && baked[object.object]?.isSolid && !(isQuarter(turn.degrees) && isQuarter(turn.from))) { problems.push(at + " is solid, so it turns only by quarter turns"); }
            if(mover.spin !== undefined && !(AXES.includes(mover.spin.axis) && isPositive(mover.spin.seconds))) { problems.push(at + " needs a spin of { axis, seconds }"); }
            if(mover.spin === undefined && !isPositive(mover.seconds)) { problems.push(at + " needs the seconds its move takes"); }
            if(!(mover.every === undefined || isPositive(mover.every)) || !(mover.near === undefined || isPositive(mover.near))) { problems.push(at + " needs every and near to be above 0"); }
        }

        if(trigger !== undefined && !((trigger.lever === true) !== (trigger.plate === true) && Array.isArray(trigger.movers))) { problems.push(at + " needs a trigger that is a lever or a plate, with a list of movers"); }
    }

    const movers = new Set(objects.filter((object) => object.mover).map((object) => object.id));

    for(const object of objects.filter((each) => each.trigger))
    {
        for(const id of object.trigger.movers ?? []) { if(!movers.has(id)) { problems.push(where + " prop " + object.index + " works an unknown mover: " + id); } }
    }
}

function isAge(age)
{
    return Number.isInteger(age) && age >= 0 && age <= 100;
}

// Each column takes the zone's age, or the age of a prefab placed over it.
function agesOf(zone, props, placed)
{
    const ages = new Uint8Array(zone.columns * zone.columns).fill(zone.weathering?.age ?? 0);
    const aged = new Map(props.filter((prop) => prop.age !== undefined).map((prop) => [prop.index, prop.age]));

    for(const { prop, box } of placed)
    {
        if(!aged.has(prop) || !box) { continue; }

        for(let row = box[2]; row <= box[5]; row++) { ages.fill(aged.get(prop), row * zone.columns + box[0], row * zone.columns + box[3] + 1); }
    }

    return ages;
}

function isHeightFog({ base, falloff, density })
{
    return Number.isFinite(base) && falloff > 0 && density >= 0 && density <= 1;
}

function checkLighting(lighting, where, problems)
{
    const colours = [lighting?.sky?.top, lighting?.sky?.horizon, lighting?.hemisphere?.sky, lighting?.hemisphere?.ground, lighting?.moon?.colour];

    if(!colours.every((colour) => COLOUR_PATTERN.test(colour ?? ""))) { problems.push(where + " needs lower-case #rrggbb lighting colours"); }
    if(!(lighting?.fog?.far > lighting?.fog?.near)) { problems.push(where + " needs a fog that ends after it starts"); }
    if(lighting?.ambient !== undefined && !(COLOUR_PATTERN.test(lighting.ambient.base ?? "") && lighting.ambient.level >= 0 && lighting.ambient.level <= 1)) { problems.push(where + " needs an ambient of { base, level }, with a lower-case #rrggbb base and a level from 0 to 1"); }
    if(lighting?.fog?.height !== undefined && !isHeightFog(lighting.fog.height)) { problems.push(where + " needs a height fog of { base, falloff, density }, with a falloff above 0 and a density from 0 to 1"); }

    for(const [name, steps] of Object.entries(lighting?.steps ?? {}))
    {
        if(!(COLOUR_PATTERN.test(steps.dark ?? "") && COLOUR_PATTERN.test(steps.bright ?? "") && steps.curve > 0)) { problems.push(where + " needs its " + name + " steps to have lower-case #rrggbb dark and bright colours and a positive curve"); }
    }
}

function checkPeople(zone, people, where, problems)
{
    for(const resident of zone.people?.residents ?? [])
    {
        if(!people.npcs[resident.npc]) { problems.push(where + " places an unknown resident: " + resident.npc); }
    }

    const crowd = zone.people?.crowd;

    if(!crowd) { return; }
    if(!people.lines[crowd.lines]) { problems.push(where + " gives its crowd unknown lines: " + crowd.lines); }

    for(const archetype of crowd.archetypes.filter(Boolean))
    {
        if(!Archetypes.ARCHETYPES.some((entry) => entry.id === archetype)) { problems.push(where + " gives its crowd an unknown archetype: " + archetype); }
    }
}
