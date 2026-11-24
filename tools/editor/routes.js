import * as childProcess from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as util from "node:util";
import { EditSession } from "./session.js";
import { Log } from "../../js/log.js";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const ZONE_ASSET = /^\/assets\/zones\/([a-z][A-Za-z0-9]*)\/((?:\d+-\d+\.bin)|index\.json)$/;
const EDITOR_ROUTE = /^\/editor\/([a-z][A-Za-z0-9]*)\/(state|open|owner|apply|undo|redo|save|discard|notes)$/;
const LOCAL_HOST = /^(127\.0\.0\.1|localhost)(:\d+)?$/;
const MAX_BODY = 16 * 1024 * 1024;


/******************************************************************************/
/* EDITOR ROUTES                                                              */
/******************************************************************************/

// Every write needs a JSON body from the server's own origin and host name,
// which a page elsewhere cannot send.
export class EditorRoutes
{
    constructor({ contentRoot = path.join(ROOT, "content"), notesRoot = path.join(ROOT, "local", "notes"), shouldBake = true } = {})
    {
        this.contentRoot = contentRoot;
        this.notesRoot = notesRoot;
        this.shouldBake = shouldBake;
        this.sessions = new Map();
        this.queue = Promise.resolve();
    }

    // The bytes an open session baked for a zone asset, or null.
    overlay(pathname)
    {
        const match = ZONE_ASSET.exec(pathname);

        return match ? this.sessions.get(match[1])?.file(match[2]) ?? null : null;
    }

    // Whether the request was an editor route, which this has answered.
    async handle(request, response, pathname)
    {
        const match = EDITOR_ROUTE.exec(pathname);

        if(!match) { return false; }

        const [, id, action] = match;

        if(!LOCAL_HOST.test(request.headers.host ?? ""))
        {
            send(response, 403, { error: "The editor answers only on this machine's own address." });
            return true;
        }

        if(request.method === "GET" && action === "state")
        {
            send(response, 200, this.sessions.get(id)?.state ?? { isDirty: false, canUndo: false, canRedo: false, steps: 0, isOpen: false });
            return true;
        }

        if(request.method === "GET" && action === "notes")
        {
            send(response, 200, this.readNotes(id));
            return true;
        }

        if(request.method !== "POST")
        {
            send(response, 405, { error: "Use POST." });
            return true;
        }

        if(!isSameOrigin(request))
        {
            send(response, 403, { error: "The editor takes requests only from its own pages." });
            return true;
        }

        try
        {
            const body = await readJson(request);

            send(response, 200, await this.serialise(() => this.act(id, action, body)));
        }
        catch(error)
        {
            Log.warn("The editor could not " + action + " " + id, error);
            send(response, 400, { error: error.message });
        }

        return true;
    }

    // Requests run one at a time, so each step bakes on the last.
    serialise(work)
    {
        const result = this.queue.then(work);

        this.queue = result.catch(() => {});

        return result;
    }

    async act(id, action, body)
    {
        if(action === "notes") { return this.writeNotes(id, body); }
        if(action === "discard") { return this.discard(id); }

        const session = await this.session(id);

        if(action === "open") { return { ...session.state, isOpen: true }; }
        if(action === "owner") { return { object: session.ownerOf(...body.cell) }; }
        if(action === "apply") { return session.apply(Array.isArray(body.operations) ? body.operations : []); }
        if(action === "undo") { return session.undo(); }
        if(action === "redo") { return session.redo(); }

        const written = session.save();

        if(this.shouldBake) { await this.bake(); }

        return { written, ...session.state };
    }

    async session(id)
    {
        if(this.sessions.has(id)) { return this.sessions.get(id); }

        const session = await EditSession.open(id, this.contentRoot);

        this.sessions.set(id, session);

        return session;
    }

    discard(id)
    {
        this.sessions.delete(id);

        return { isDirty: false, canUndo: false, canRedo: false, steps: 0, isOpen: false };
    }

    // The bake runs in its own process, so it reads the content as saved.
    async bake()
    {
        try
        {
            await util.promisify(childProcess.execFile)(process.execPath, [path.join(ROOT, "tools", "bake", "bake.js")], { cwd: ROOT });
            Log.info("Baked the editor's save. Accept the changed assets with npm run bake -- --accept once they are reviewed.");
        }
        catch(error)
        {
            Log.warn("The bake after the editor's save failed:\n" + (error.stdout ?? "") + (error.stderr ?? ""));
        }
    }

    /* NOTES ******************************************************************/

    notesPath(id)
    {
        return path.join(this.notesRoot, id + ".json");
    }

    readNotes(id)
    {
        const file = this.notesPath(id);

        return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : [];
    }

    writeNotes(id, notes)
    {
        if(!Array.isArray(notes)) { throw new Error("The notes must be a list."); }

        fs.mkdirSync(this.notesRoot, { recursive: true });
        fs.writeFileSync(this.notesPath(id), JSON.stringify(notes, null, 4) + "\n");

        return { count: notes.length };
    }
}

// A cross-origin page can send a form, but not a JSON body without asking
// first, which this server never allows.
function isSameOrigin(request)
{
    const origin = request.headers.origin;
    const isJson = (request.headers["content-type"] ?? "").startsWith("application/json");

    return isJson && (origin === undefined || origin === "http://" + request.headers.host);
}

function readJson(request)
{
    return new Promise((resolve, reject) =>
    {
        const parts = [];
        let size = 0;

        request.on("data", (part) =>
        {
            size += part.length;

            if(size > MAX_BODY)
            {
                reject(new Error("The request is too large."));
                request.destroy();
                return;
            }

            parts.push(part);
        });
        request.on("end", () =>
        {
            try
            {
                resolve(parts.length === 0 ? {} : JSON.parse(Buffer.concat(parts).toString("utf8")));
            }
            catch(error)
            {
                reject(new Error("The request is not JSON: " + error.message));
            }
        });
        request.on("error", reject);
    });
}

function send(response, status, body)
{
    const bytes = Buffer.from(JSON.stringify(body));

    response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Content-Length": bytes.length, "Cache-Control": "no-store" });
    response.end(bytes);
}
