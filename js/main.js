import { App } from "./app.js";
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

try
{
    const app = new App(document.getElementById("app"), readStorage());

    window.foreverQuest = app;
    app.start();
}
catch(error)
{
    Log.error("ForeverQuest failed to start", error);
    document.getElementById("app").textContent = "ForeverQuest could not start. WebGL may be unavailable in this browser.";
}
