import { AssetSource } from "../../../js/engine/asset-source.js";
import { Library } from "../../../js/kit/library.js";
import { Log } from "../../../js/log.js";
import { ModelViewer } from "./model-viewer.js";
import { Renderer } from "../../../js/engine/renderer.js";

const DEFAULTS = { body: "human", variant: "male", height: 0, build: 0, skin: "", gear: "default", seed: 1, motion: "idle", overlay: false, yaw: 0.5, zoom: 1 };
const NUMBERS = ["height", "build", "seed", "yaw", "zoom"];
const SWITCHES = ["overlay"];


/******************************************************************************/
/* STATE                                                                      */
/******************************************************************************/

function readState()
{
    const params = new URLSearchParams(location.search);
    const state = { ...DEFAULTS };

    for(const key of Object.keys(DEFAULTS))
    {
        if(!params.has(key)) { continue; }

        const text = params.get(key);

        if(NUMBERS.includes(key)) { state[key] = Number.isFinite(Number(text)) ? Number(text) : DEFAULTS[key]; }
        else if(SWITCHES.includes(key)) { state[key] = text === "1" || text === "bones"; }
        else { state[key] = text; }
    }

    return state;
}

function writeState(state)
{
    const params = new URLSearchParams();

    for(const [key, value] of Object.entries(state))
    {
        if(value === DEFAULTS[key]) { continue; }

        params.set(key, SWITCHES.includes(key) ? "1" : NUMBERS.includes(key) ? String(Math.round(value * 1000) / 1000) : value);
    }

    history.replaceState(null, "", "?" + params.toString());
}


/******************************************************************************/
/* START                                                                      */
/******************************************************************************/

async function start()
{
    const container = document.getElementById("app");

    try
    {
        const renderer = new Renderer(container);
        const library = await Library.load(await AssetSource.http("../../assets/"));
        const viewer = new ModelViewer(container, renderer.canvas, library, readState(), writeState);

        window.workbench = { renderer, library, viewer, isReady: false };
        renderer.setScreen(viewer);
        renderer.start();
        window.workbench.isReady = true;
    }
    catch(error)
    {
        Log.error("The workbench failed to start", error);
        container.textContent = "The workbench could not start. Run npm run bake, then reload.";
    }
}

await start();
