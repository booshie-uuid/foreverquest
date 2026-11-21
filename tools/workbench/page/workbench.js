import * as Controls from "../../../js/ui/controls.js";
import { AssetSource } from "../../../js/engine/asset-source.js";
import { Library } from "../../../js/kit/library.js";
import { Log } from "../../../js/log.js";
import { MaterialLibrary } from "../../../js/engine/materials.js";
import { ModelViewer } from "./model-viewer.js";
import { PropViewer } from "./prop-viewer.js";
import { Renderer } from "../../../js/engine/renderer.js";
import { WorldAtlas } from "../../../js/engine/world-atlas.js";

const VIEWS = [{ id: "models", name: "Models" }, { id: "props", name: "Props" }];
const DEFAULTS = { view: "models", prefab: "", body: "human", variant: "male", height: 0, build: 0, skin: "", gear: "default", seed: 1, motion: "idle", overlay: false, yaw: 0.5, zoom: 1 };
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

function viewSwitch(current)
{
    const group = Controls.element("nav", "panel toggle-group workbench-views");

    for(const view of VIEWS)
    {
        const link = Controls.element("a", "toggle", view.name);

        link.href = "?view=" + view.id;
        link.classList.toggle("is-active", view.id === current);
        group.append(link);
    }

    return group;
}

async function start()
{
    const container = document.getElementById("app");

    try
    {
        const renderer = new Renderer(container);
        const assets = await AssetSource.http("../../assets/");
        const library = await Library.load(assets);
        const state = readState();
        const viewer = state.view === "props"
            ? new PropViewer(container, renderer.canvas, new MaterialLibrary(await WorldAtlas.load(assets)), await assets.json("props/prefabs.json"), state, writeState)
            : new ModelViewer(container, renderer.canvas, library, state, writeState);

        container.append(viewSwitch(state.view));
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
