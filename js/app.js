import * as Controls from "./ui/controls.js";
import { Appearance } from "./character/appearance.js";
import { CharacterStore } from "./character-store.js";
import { CreatorScreen } from "./ui/creator-screen.js";
import { GameScreen } from "./game/game-screen.js";
import { GraphicsSettings } from "./engine/graphics-settings.js";
import { Library } from "./kit/library.js";
import { MaterialLibrary } from "./engine/materials.js";
import { Renderer } from "./engine/renderer.js";
import { WorldAtlas } from "./engine/world-atlas.js";
import { ZoneData } from "./sim/zone-data.js";

export class App
{
    constructor(container, storage, assets, { zone = "hearthmere" } = {})
    {
        this.container = container;
        this.assets = assets;
        this.startZone = zone;
        this.content = null;
        this.zone = null;
        this.store = new CharacterStore(storage);
        this.renderer = new Renderer(container);
        this.graphics = new GraphicsSettings(this.renderer);
        this.library = null;
        this.appearance = null;
        this.materials = null;
        this.creator = null;
        this.game = null;
        this.isReady = false;
    }

    async start()
    {
        const loading = Controls.element("div", "loading", "Loading…");

        this.container.append(loading);

        try
        {
            this.library = await Library.load(this.assets);
            this.materials = new MaterialLibrary(await WorldAtlas.load(this.assets));
            this.content = { prefabs: await this.assets.json("props/prefabs.json"), people: await this.assets.json("npcs.json") };
            this.zone = await this.loadZone(this.startZone);
        }
        finally
        {
            loading.remove();
        }

        this.appearance = new Appearance(this.library, this.store.load() ?? {});
        this.creator = new CreatorScreen(
            this.container,
            this.library,
            this.materials,
            this.content.prefabs,
            this.graphics,
            (draft) => this.confirmCreator(draft),
            () => this.showGame(),
        );

        this.showCreator("create");
        this.renderer.start();
        this.isReady = true;
    }

    async loadZone(id)
    {
        return new ZoneData(await this.assets.json("zones/" + id + ".json"), this.content.prefabs);
    }

    async travel(id)
    {
        this.zone = await this.loadZone(id);
        this.game?.enterZone(this.zone);
    }

    get screen()
    {
        return this.renderer.screen === this.game ? "game" : "creator";
    }

    showCreator(mode)
    {
        this.creator.open(this.appearance, mode === "edit" ? "edit" : "create");
        this.renderer.setScreen(this.creator);
    }

    confirmCreator(draft)
    {
        this.appearance.replace(draft.toJSON());
        this.store.save(this.appearance);
        this.showGame();
    }

    showGame()
    {
        if(!this.game)
        {
            this.game = new GameScreen(this.container, this.renderer.canvas, this.appearance, this.materials, this.graphics, () => this.showCreator("edit"), this.content, this.zone);
        }

        this.renderer.setScreen(this.game);
    }
}
