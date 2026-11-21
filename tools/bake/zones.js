import * as Archetypes from "../../content/archetypes.js";
import * as Prefabs from "../../content/props/prefabs.js";
import * as PropBaker from "./props.js";
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

    for(const file of fs.readdirSync(path.join(CONTENT, "zones")).filter((name) => name.endsWith(".json")).sort())
    {
        const zone = JSON.parse(fs.readFileSync(path.join(CONTENT, "zones", file), "utf8"));
        const baked = bakeZone(zone, people, context, "Zone zones/" + file, problems);

        if(!baked) { continue; }

        ids.push(zone.id);
        files.push({ path: "zones/" + zone.id + ".json", bytes: Buffer.from(JSON.stringify(baked) + "\n") });
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

export function bakeZone(zone, people, context, where, problems)
{
    const before = problems.length;
    const size = zone.size;

    if(!ID_PATTERN.test(zone.id ?? "")) { problems.push(where + " has an invalid id: " + zone.id); }
    if(!(Number.isInteger(size) && size > 0 && size % 16 === 0)) { problems.push(where + " needs a size that is a whole multiple of 16 tiles"); return null; }

    checkTiles(zone, context, where, problems);
    checkLighting(zone.lighting, where, problems);
    checkPeople(zone, people, where, problems);

    const half = size / 2;

    if(!(Math.abs(zone.spawn?.x) < half && Math.abs(zone.spawn?.z) < half)) { problems.push(where + " needs a spawn point inside the zone"); }
    if(zone.welcome !== undefined && !(Array.isArray(zone.welcome) && zone.welcome.every((line) => typeof line === "string"))) { problems.push(where + " needs its welcome to be a list of lines"); }
    if(problems.length > before) { return null; }

    const heightAt = heightsOf(zone);
    const runs = [];
    const props = [];

    for(const [i, prop] of (zone.props ?? []).entries())
    {
        if(prop.run)
        {
            if(!Prefabs.RUNS[prop.run]) { problems.push(where + " prop " + i + " is an unknown run: " + prop.run); continue; }

            const run = PropBaker.record(Prefabs.RUNS[prop.run], prop.points, heightAt);

            PropBaker.checkFaces(run.blocks, context.worldTextures, where + " run " + i, problems);
            props.push({ run: runs.length });
            runs.push(run);
            continue;
        }

        if(!context.prefabs[prop.prefab]) { problems.push(where + " prop " + i + " is an unknown prefab: " + prop.prefab); continue; }
        if(!(Math.abs(prop.x) < half && Math.abs(prop.z) < half)) { problems.push(where + " prop " + i + " is outside the zone"); }

        props.push(prop);
    }

    if(problems.length > before) { return null; }

    return { ...zone, props, runs };
}

function checkTiles(zone, context, where, problems)
{
    const isRows = (rows) => Array.isArray(rows) && rows.length === zone.size;

    if(!isRows(zone.levels) || !zone.levels.every((row) => row.split(",").length === zone.size && row.split(",").every((value) => Number.isInteger(Number(value)))))
    {
        problems.push(where + " needs " + zone.size + " rows of " + zone.size + " whole-number levels");
    }

    if(!isRows(zone.types) || !zone.types.every((row) => row.length === zone.size && [...row].every((code) => zone.typeCodes?.[code])))
    {
        problems.push(where + " needs " + zone.size + " rows of " + zone.size + " tile type codes from its typeCodes");
    }

    for(const type of Object.values(zone.typeCodes ?? {}))
    {
        if(!context.worldTextures.includes(type)) { problems.push(where + " has a tile type with no world texture: " + type); }
    }
}

function checkLighting(lighting, where, problems)
{
    const colours = [lighting?.sky?.top, lighting?.sky?.horizon, lighting?.hemisphere?.sky, lighting?.hemisphere?.ground, lighting?.moon?.colour, lighting?.lamp?.colour];

    if(!colours.every((colour) => COLOUR_PATTERN.test(colour ?? ""))) { problems.push(where + " needs lower-case #rrggbb lighting colours"); }
    if(!(lighting?.fog?.far > lighting?.fog?.near)) { problems.push(where + " needs a fog that ends after it starts"); }
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

export function heightsOf(zone)
{
    const half = zone.size / 2;
    const levels = zone.levels.map((row) => row.split(",").map(Number));

    return (x, z) =>
    {
        const column = Math.max(0, Math.min(zone.size - 1, Math.floor(x + half)));
        const row = Math.max(0, Math.min(zone.size - 1, Math.floor(z + half)));

        return levels[row][column] * zone.step;
    };
}
