import * as Controls from "./ui/controls.js";
import { Appearance } from "./character/appearance.js";
import { BlockSet } from "./sim/block-set.js";
import { CharacterStore } from "./character-store.js";
import { CreatorScreen } from "./ui/creator-screen.js";
import { GameScreen } from "./game/game-screen.js";
import { GraphicsSettings } from "./engine/graphics-settings.js";
import { Library } from "./kit/library.js";
import { MaterialLibrary } from "./engine/materials.js";
import { RegionStreamer } from "./engine/region-streamer.js";
import { Renderer } from "./engine/renderer.js";
import { StatsOverlay } from "./ui/stats-overlay.js";
import { WorldAtlas } from "./engine/world-atlas.js";

export class App
{
    // `edit` opens the game in the editor, with the camera at `edit.view`
    // when it is given.
    constructor(container, storage, assets, { zone = "hearthmere", showStats = false, edit = null } = {})
    {
        this.container = container;
        this.assets = assets;
        this.startZone = zone;
        this.showStats = showStats;
        this.edit = edit;
        this.stats = null;
        this.content = null;
        this.streamer = null;
        this.store = new CharacterStore(storage);
        this.renderer = new Renderer(container);
        this.graphics = new GraphicsSettings();
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
            this.content = { prefabs: await this.assets.json("props/prefabs.json"), objects: await this.assets.json("objects.json"), people: await this.assets.json("npcs.json"), zones: await this.assets.json("zones/index.json"), blocks: await BlockSet.load(this.assets) };
            this.streamer = await this.loadZone(this.startZone);
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

        if(this.showStats) { this.stats = new StatsOverlay(this.container, this); }

        if(this.edit)
        {
            this.showGame();
            await this.game.editMode.enter(this.edit.view);
        }

        this.isReady = true;
    }

    async loadZone(id)
    {
        return RegionStreamer.open(this.assets, id, this.content.blocks);
    }

    async travel(id)
    {
        const streamer = await this.loadZone(id);

        if(this.game) { this.game.enterZone(streamer); }
        else { this.streamer.dispose(); }

        this.streamer = streamer;
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
            this.game = new GameScreen(this.container, this.renderer.canvas, this.appearance, this.materials, this.graphics, () => this.showCreator("edit"), this.content, this.streamer, (id) => this.travel(id));
        }

        this.renderer.setScreen(this.game);
    }
}
