import * as Blocks from "./bake/blocks.js";
import * as Terrain from "./bake/terrain.js";
import * as WorldTextures from "./bake/world-textures.js";
import * as Zones from "./bake/zones.js";
import * as fs from "node:fs";
import * as path from "node:path";
import { Log } from "../js/log.js";

const CONTENT = path.resolve(import.meta.dirname, "..", "content");
const USAGE = "Usage: node tools/lock-terrain.js <zone id>";


/******************************************************************************/
/* LOCK                                                                       */
/******************************************************************************/

// Writes the zone's terrain as locked cubes and deletes its terrain source and
// ground list, which the bake no longer reads.
export async function lock(id)
{
    const folder = path.join(CONTENT, "zones", id);
    const zonePath = path.join(folder, "zone.json");
    const where = "Zone zones/" + id;
    const problems = [];
    const context = {};

    if(!fs.existsSync(zonePath)) { throw new Error("There is no zone " + id + "."); }
    if(Terrain.isLocked(folder)) { throw new Error(where + " is already locked."); }

    await WorldTextures.bake(problems, context);
    await Blocks.bake(problems, context);

    const zone = JSON.parse(fs.readFileSync(zonePath, "utf8"));
    const ground = Zones.groundOf(zone, context, where, problems);
    const terrain = await Terrain.readColumns(folder, zone, where, problems);

    if(problems.length > 0) { throw new Error(problems.join("\n")); }

    const numbers = Object.fromEntries(context.blocks.map((block, i) => [block.id, i + 1]));
    const files = Terrain.lockedFiles(zone, terrain, ground, numbers, context.blocks.map((block) => block.id));
    const lockedFolder = path.join(folder, Terrain.LOCKED_FOLDER);

    fs.mkdirSync(lockedFolder);

    for(const file of files) { fs.writeFileSync(path.join(lockedFolder, file.path), file.bytes); }

    fs.rmSync(path.join(folder, "terrain.js"), { force: true });
    fs.rmSync(path.join(folder, "terrain"), { recursive: true, force: true });
    delete zone.ground;
    fs.writeFileSync(zonePath, JSON.stringify(zone, null, 4) + "\n");

    return files.length - 1;
}


/******************************************************************************/
/* COMMAND LINE                                                               */
/******************************************************************************/

async function main()
{
    const id = process.argv[2];

    if(!id)
    {
        Log.error(USAGE);
        process.exitCode = 1;
        return;
    }

    try
    {
        const count = await lock(id);

        Log.info("Locked " + count + " region" + (count === 1 ? "" : "s") + " of " + id + " into content/zones/" + id + "/" + Terrain.LOCKED_FOLDER + "/.");
    }
    catch(error)
    {
        Log.error("Could not lock the terrain of " + id + ".", error);
        process.exitCode = 1;
    }
}

if(import.meta.main) { await main(); }
