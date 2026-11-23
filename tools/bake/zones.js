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

async function loadPeople()
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

export async function bakeZone(zone, folder, people, context, where, problems)
{
    const before = problems.length;

    if(!ID_PATTERN.test(zone.id ?? "")) { problems.push(where + " has an invalid id: " + zone.id); }

    checkShape(zone, where, problems);

    if(problems.length > before) { return null; }

    const ground = groundOf(zone, context, where, problems);

    checkLighting(zone.lighting, where, problems);
    checkPeople(zone, people, where, problems);

    const half = zone.columns / Terrain.CUBES_PER_METRE / 2;

    if(!(Math.abs(zone.spawn?.x) < half && Math.abs(zone.spawn?.z) < half)) { problems.push(where + " needs a spawn point inside the zone"); }
    if(zone.welcome !== undefined && !(Array.isArray(zone.welcome) && zone.welcome.every((line) => typeof line === "string"))) { problems.push(where + " needs its welcome to be a list of lines"); }
    if(problems.length > before) { return null; }

    const terrain = await Terrain.readColumns(folder, zone, where, problems);

    if(problems.length > before) { return null; }

    const heightAt = Terrain.heightsOf(zone, terrain.surfaces);
    const runs = [];
    const props = [];

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

        if(!context.prefabs[prop.prefab]) { problems.push(where + " prop " + i + " is an unknown prefab: " + prop.prefab); continue; }
        if(!(Math.abs(prop.x) < half && Math.abs(prop.z) < half)) { problems.push(where + " prop " + i + " is outside the zone"); }

        props.push({ ...prop, index: i, y: heightAt(prop.x, prop.z) });
    }

    if(problems.length > before) { return null; }

    const numbers = Object.fromEntries(context.blocks.map((block, i) => [block.id, i + 1]));
    const terrainTop = (column, row) => terrain.surfaces[row * zone.columns + column];
    const placed = Voxelise.zoneCells(zone, props, runs, context.prefabs, numbers, where, problems, terrainTop);

    if(problems.length > before) { return null; }

    const solid = new Set(context.blocks.flatMap((block, i) => (block.kind === "liquid" ? [] : [i + 1])));
    const regions = Terrain.bakeRegions(zone, terrain, ground, numbers, { cells: placed.cells, solid });
    const { id, name, welcome, columns, height, base, water, lighting, spawn } = zone;
    const index = { id, name, welcome, columns, height, base, water, lighting, spawn, people: zone.people, objects: placed.objects, regions: regions.map((region) => region.name) };

    return { index, regions };
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

function groundOf(zone, context, where, problems)
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

function checkLighting(lighting, where, problems)
{
    const colours = [lighting?.sky?.top, lighting?.sky?.horizon, lighting?.hemisphere?.sky, lighting?.hemisphere?.ground, lighting?.moon?.colour];

    if(!colours.every((colour) => COLOUR_PATTERN.test(colour ?? ""))) { problems.push(where + " needs lower-case #rrggbb lighting colours"); }
    if(!(lighting?.fog?.far > lighting?.fog?.near)) { problems.push(where + " needs a fog that ends after it starts"); }

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
