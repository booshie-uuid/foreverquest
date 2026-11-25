import { App } from "./app.js";
import { AssetSource } from "./engine/asset-source.js";
import { Log } from "./log.js";

function readStorage()
{
    try
    {
        return window.localStorage;
    }
    catch(error)
    {
        Log.warn("Browser storage is unavailable; the character will not be saved", error);

        return null;
    }
}

// `?edit` opens the editor; `view=x,y,z,yaw,pitch` sets its camera, and
// `bench=id` opens that object in the bench.
function editOf(params)
{
    if(!params.has("edit")) { return null; }

    const values = (params.get("view") ?? "").split(",").map(Number);
    const isView = values.length === 5 && values.every(Number.isFinite);

    return { view: isView ? { x: values[0], y: values[1], z: values[2], yaw: values[3], pitch: values[4] } : null, bench: params.get("bench") };
}

async function start()
{
    const container = document.getElementById("app");

    try
    {
        const params = new URLSearchParams(location.search);
        const app = new App(container, readStorage(), await AssetSource.http("assets/"), { zone: params.get("zone") ?? undefined, showStats: params.has("stats"), edit: editOf(params) });

        window.foreverQuest = app;
        await app.start();
    }
    catch(error)
    {
        Log.error("ForeverQuest failed to start", error);
        container.textContent = "ForeverQuest could not start. Its assets may be missing, or WebGL may be unavailable in this browser.";
    }
}

await start();
