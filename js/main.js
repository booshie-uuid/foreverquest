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

async function start()
{
    const container = document.getElementById("app");

    try
    {
        const app = new App(container, readStorage(), await AssetSource.http("assets/"));

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
