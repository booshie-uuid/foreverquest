import * as Blocks from "./blocks.js";
import * as Clips from "./clips.js";
import * as Migrations from "../../content/migrations.js";
import * as Models from "./models.js";
import * as Objects from "./objects.js";
import * as Parts from "./parts.js";
import * as Props from "./props.js";
import * as Stamps from "./stamps.js";
import * as WorldTextures from "./world-textures.js";
import * as Zones from "./zones.js";
import * as childProcess from "node:child_process";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import * as util from "node:util";
import { Log } from "../../js/log.js";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const ASSETS = path.join(ROOT, "assets");
const LOCK = path.join(ROOT, "assets.lock.json");
const WATCHED = ["content", "js"];
const WATCH_DELAY_MS = 200;
const BAKERS = [WorldTextures, Blocks, Stamps, Models, Parts, Clips, Props, Objects, Zones];
const USAGE = "Usage: node tools/bake/bake.js [--accept] [--watch]";


/******************************************************************************/
/* BAKE                                                                       */
/******************************************************************************/

export class BakeError extends Error
{
    constructor(problems)
    {
        super("The content has " + problems.length + " problem" + (problems.length === 1 ? "" : "s") + ":\n" + problems.map((problem) => "  - " + problem).join("\n"));
        this.problems = problems;
    }
}

export async function bake({ shouldAccept = false } = {})
{
    const problems = [];
    const files = [{ path: "migrations.json", bytes: Buffer.from(JSON.stringify(Migrations.IDS, null, 4) + "\n") }];
    const ids = {};
    const context = {};

    for(const baker of BAKERS)
    {
        const output = await baker.bake(problems, context);

        files.push(...output.files);
        Object.assign(ids, output.ids);
    }

    const lock = readLock();

    problems.push(...checkIds(lock.ids, ids, Migrations.IDS));

    if(problems.length > 0) { throw new BakeError(problems); }

    const manifest = writeAssets(files, ids);
    const changes = compare(lock.files, manifest.files);

    if(shouldAccept) { writeLock(manifest); }

    return { manifest, changes, isAccepted: shouldAccept || changes.length === 0 };
}

function readLock()
{
    if(!fs.existsSync(LOCK)) { return { files: {}, ids: {} }; }

    return JSON.parse(fs.readFileSync(LOCK, "utf8"));
}

export function checkIds(locked, baked, migrations)
{
    const problems = [];

    for(const [kind, lockedIds] of Object.entries(locked))
    {
        const current = new Set(baked[kind] ?? []);
        const replacements = migrations[kind] ?? {};

        for(const id of lockedIds)
        {
            if(current.has(id)) { continue; }

            const replacement = replacements[id];

            if(replacement === undefined)
            {
                problems.push("The " + kind + " id \"" + id + "\" is gone. Map it to a replacement in content/migrations.js");
            }
            else if(!current.has(replacement))
            {
                problems.push("The " + kind + " id \"" + id + "\" maps to \"" + replacement + "\", which does not exist");
            }
        }
    }

    return problems;
}

function writeAssets(files, ids)
{
    const manifest = { files: {}, ids: sortIds(ids) };

    fs.rmSync(ASSETS, { recursive: true, force: true });

    for(const file of [...files].sort((a, b) => a.path.localeCompare(b.path)))
    {
        const target = path.join(ASSETS, file.path);

        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, file.bytes);
        manifest.files[file.path] = { sha256: crypto.createHash("sha256").update(file.bytes).digest("hex"), bytes: file.bytes.length };
    }

    fs.writeFileSync(path.join(ASSETS, "manifest.json"), JSON.stringify(manifest, null, 4) + "\n");

    return manifest;
}

function sortIds(ids)
{
    return Object.fromEntries(Object.keys(ids).sort().map((kind) => [kind, [...ids[kind]].sort()]));
}

export function compare(lockedFiles, bakedFiles)
{
    const changes = [];

    for(const [file, entry] of Object.entries(bakedFiles))
    {
        if(!(file in lockedFiles)) { changes.push("added " + file); }
        else if(lockedFiles[file] !== entry.sha256) { changes.push("changed " + file); }
    }

    for(const file of Object.keys(lockedFiles))
    {
        if(!(file in bakedFiles)) { changes.push("removed " + file); }
    }

    return changes;
}

function writeLock(manifest)
{
    const files = Object.fromEntries(Object.entries(manifest.files).map(([file, entry]) => [file, entry.sha256]));

    fs.writeFileSync(LOCK, JSON.stringify({ files, ids: manifest.ids }, null, 4) + "\n");
}


/******************************************************************************/
/* COMMAND LINE                                                               */
/******************************************************************************/

async function runOnce(shouldAccept)
{
    try
    {
        const result = await bake({ shouldAccept });
        const count = Object.keys(result.manifest.files).length;

        Log.info("Baked " + count + " asset" + (count === 1 ? "" : "s") + " into assets/");

        if(result.changes.length > 0 && shouldAccept) { Log.info("Accepted into assets.lock.json:\n  " + result.changes.join("\n  ")); }

        if(!result.isAccepted)
        {
            Log.warn("These assets differ from assets.lock.json, so the tests will fail until the change is accepted:\n  "
                + result.changes.join("\n  ")
                + "\nReview them, then run: npm run bake -- --accept");
        }

        return true;
    }
    catch(error)
    {
        Log.error(error instanceof BakeError ? error.message : "The bake failed.", error instanceof BakeError ? "" : error);

        return false;
    }
}

// Each rebake runs in a new process, because Node caches the content modules
// that a process has imported.
function watch()
{
    let timer = null;

    const rebake = () =>
    {
        childProcess.spawnSync(process.execPath, [import.meta.filename], { stdio: "inherit" });
    };

    rebake();

    for(const folder of WATCHED)
    {
        fs.watch(path.join(ROOT, folder), { recursive: true }, () =>
        {
            clearTimeout(timer);
            timer = setTimeout(rebake, WATCH_DELAY_MS);
        });
    }

    Log.info("Watching " + WATCHED.join(" and ") + " for changes.");
}

async function main()
{
    let values;

    try
    {
        ({ values } = util.parseArgs({ options: { accept: { type: "boolean", default: false }, watch: { type: "boolean", default: false } } }));
    }
    catch(error)
    {
        Log.error(error.message + "\n" + USAGE);
        process.exitCode = 1;
        return;
    }

    if(values.watch)
    {
        watch();
        return;
    }

    if(!(await runOnce(values.accept))) { process.exitCode = 1; }
}

if(import.meta.main) { await main(); }
