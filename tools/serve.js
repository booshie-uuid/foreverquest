import * as fs from "node:fs";
import * as http from "node:http";
import * as path from "node:path";
import * as url from "node:url";

import { Log } from "../js/log.js";

const DEFAULT_PORT = 8080;
const HOST = "127.0.0.1";
const PROJECT_ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");

const MIME_TYPES =
{
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".ico": "image/x-icon",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml",
};


/******************************************************************************/
/* SERVER                                                                     */
/******************************************************************************/

// `editor`, when given, answers the zone editor's routes and serves the
// zone assets its sessions have baked.
export function startServer({ root = PROJECT_ROOT, port = 0, editor = null } = {})
{
    const rootPath = path.resolve(root);

    const server = http.createServer((request, response) =>
    {
        handleRequest(rootPath, request, response, editor).catch((error) =>
        {
            Log.error("Could not serve " + request.url, error);

            sendStatus(response, 500);
        });
    });

    return new Promise((resolve, reject) =>
    {
        server.once("error", reject);
        server.listen(port, HOST, () =>
        {
            server.off("error", reject);

            resolve(
            {
                url: "http://" + HOST + ":" + server.address().port,
                close: () => closeServer(server),
            });
        });
    });
}

function closeServer(server)
{
    return new Promise((resolve) =>
    {
        server.close(() => resolve());
        server.closeAllConnections();
    });
}

/* REQUESTS *******************************************************************/

async function handleRequest(rootPath, request, response, editor)
{
    const pathname = pathOf(request.url);

    if(editor && pathname !== null && await editor.handle(request, response, pathname)) { return; }

    if(request.method !== "GET" && request.method !== "HEAD")
    {
        response.setHeader("Allow", "GET, HEAD");
        sendStatus(response, 405);
        return;
    }

    const filePath = resolveFilePath(rootPath, request.url);

    if(!filePath)
    {
        sendStatus(response, 403);
        return;
    }

    const baked = editor?.overlay(pathname) ?? null;

    if(baked)
    {
        response.writeHead(200, { "Content-Type": MIME_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream", "Content-Length": baked.length, "Cache-Control": "no-store" });
        response.end(request.method === "HEAD" ? undefined : baked);
        return;
    }

    const stats = await statFile(filePath);

    if(!stats)
    {
        sendStatus(response, 404);
        return;
    }

    response.writeHead(200,
    {
        "Content-Type": MIME_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream",
        "Content-Length": stats.size,
        "Cache-Control": "no-store",
    });

    if(request.method === "HEAD")
    {
        response.end();
        return;
    }

    fs.createReadStream(filePath)
        .on("error", (error) =>
        {
            Log.error("Could not read " + filePath, error);

            response.destroy();
        })
        .pipe(response);
}

function pathOf(requestUrl)
{
    try
    {
        return decodeURIComponent(new URL(requestUrl, "http://" + HOST).pathname);
    }
    catch
    {
        return null;
    }
}

function resolveFilePath(rootPath, requestUrl)
{
    let pathname = pathOf(requestUrl);

    if(pathname === null || pathname.includes("\0")) { return null; }

    if(pathname.endsWith("/")) { pathname += "index.html"; }

    const filePath = path.resolve(rootPath, "." + pathname);
    const isInsideRoot = filePath.startsWith(rootPath + path.sep);

    return isInsideRoot ? filePath : null;
}

async function statFile(filePath)
{
    try
    {
        const stats = await fs.promises.stat(filePath);

        return stats.isFile() ? stats : null;
    }
    catch(error)
    {
        if(error.code === "ENOENT" || error.code === "ENOTDIR") { return null; }

        throw error;
    }
}

function sendStatus(response, status)
{
    if(response.headersSent)
    {
        response.destroy();
        return;
    }

    response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(status + " " + http.STATUS_CODES[status]);
}


/******************************************************************************/
/* COMMAND LINE                                                               */
/******************************************************************************/

async function main()
{
    const port = process.argv[2] === undefined ? DEFAULT_PORT : Number(process.argv[2]);

    if(!Number.isInteger(port) || port < 0 || port > 65535)
    {
        Log.error("The port must be a whole number from 0 to 65535, not " + process.argv[2] + ".");
        process.exitCode = 1;
        return;
    }

    try
    {
        const { EditorRoutes } = await import("./editor/routes.js");
        const server = await startServer({ root: PROJECT_ROOT, port, editor: new EditorRoutes() });

        Log.info("Serving " + PROJECT_ROOT + " at " + server.url + "/");
    }
    catch(error)
    {
        Log.error("Could not start the server on port " + port + ".", error);
        process.exitCode = 1;
    }
}

if(import.meta.main) { await main(); }
