import * as Server from "./serve.js";
import * as fs from "node:fs";
import * as path from "node:path";
import { Browser } from "../js-tests/browser/cdp.js";
import { EditorRoutes } from "./editor/routes.js";
import { Log } from "../js/log.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const NOTES = path.join(ROOT, "local", "notes");
const SCREENS = path.join(ROOT, "local", "screens");
const SETTLE_MS = 600;
const USAGE = "Usage:\n"
    + "  node tools/notes.js list [zone]               every note, or a zone's\n"
    + "  node tools/notes.js capture <zone> <id>       a screenshot of the note's view\n"
    + "  node tools/notes.js reply <zone> <id> <text>  answer a note";


/******************************************************************************/
/* NOTES                                                                      */
/******************************************************************************/

function read(zone)
{
    const file = path.join(NOTES, zone + ".json");

    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : [];
}

function find(zone, id)
{
    const notes = read(zone);
    const note = notes.find((entry) => entry.id === Number(id));

    if(!note) { throw new Error("There is no note " + id + " in " + zone + "."); }

    return { notes, note };
}

function list(zone)
{
    const zones = zone ? [zone] : (fs.existsSync(NOTES) ? fs.readdirSync(NOTES) : []).filter((name) => name.endsWith(".json")).map((name) => name.slice(0, -5));
    const lines = [];

    for(const id of zones)
    {
        for(const note of read(id))
        {
            const { x, y, z, yaw, pitch } = note.view;

            lines.push(id + " " + note.id + " [" + note.status + "] cell " + note.cell.join(", ") + (note.selected ? ", selected " + note.selected : "") + ", view " + [x, y, z, yaw, pitch].map((value) => value.toFixed(2)).join(","));
            lines.push("  " + note.text);

            if(note.reply) { lines.push("  reply: " + note.reply); }
        }
    }

    return lines.length > 0 ? lines.join("\n") : "There are no notes.";
}

// Opens the game in the editor at the note's view, from the saved content,
// with the note's card open and the other panels hidden.
async function capture(zone, id)
{
    const { note } = find(zone, id);
    const server = await Server.startServer({ root: ROOT, port: 0, editor: new EditorRoutes({ shouldBake: false }) });
    const target = path.join(SCREENS, "note-" + zone + "-" + note.id + ".png");
    let browser = null;

    try
    {
        browser = await Browser.launch({ headless: true });

        const page = await browser.newPage();
        const { x, y, z, yaw, pitch } = note.view;

        await page.goto(server.url + "/index.html?zone=" + zone + "&edit&view=" + [x, y, z, yaw, pitch].join(","));
        await page.waitFor(() => window.foreverQuest?.isReady === true && window.foreverQuest.game?.editMode.isActive, { timeout: 60000 });
        await page.waitFor(() => window.foreverQuest.game.world.isSettled, { timeout: 60000 });
        await page.evaluate((noteId) =>
        {
            const edit = window.foreverQuest.game.editMode;

            edit.setTool("notes");
            edit.tools.notes.show(edit.tools.notes.notes.find((entry) => entry.id === noteId), false);

            for(const selector of [".editor-bar", ".editor-palette", ".editor-status"]) { document.querySelector(selector).hidden = true; }
        }, note.id);
        await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
        fs.mkdirSync(SCREENS, { recursive: true });
        await page.screenshot(target);

        if(page.errors.length > 0) { throw new Error("The game reported errors:\n" + page.errors.join("\n")); }

        return target;
    }
    finally
    {
        await browser?.close();
        await server.close();
    }
}

function reply(zone, id, text)
{
    const { notes, note } = find(zone, id);

    note.reply = text;
    note.status = "answered";
    fs.writeFileSync(path.join(NOTES, zone + ".json"), JSON.stringify(notes, null, 4) + "\n");
}


/******************************************************************************/
/* COMMAND LINE                                                               */
/******************************************************************************/

async function main()
{
    const [command, zone, id, ...words] = process.argv.slice(2);

    try
    {
        if(command === "list") { Log.info(list(zone)); }
        else if(command === "capture" && zone && id) { Log.info("Saved " + path.relative(ROOT, await capture(zone, id))); }
        else if(command === "reply" && zone && id && words.length > 0)
        {
            reply(zone, id, words.join(" "));
            Log.info("Answered note " + id + " in " + zone + ".");
        }
        else
        {
            Log.error(USAGE);
            process.exitCode = 1;
        }
    }
    catch(error)
    {
        Log.error("The notes command failed.", error);
        process.exitCode = 1;
    }
}

if(import.meta.main) { await main(); }
