import * as Controls from "./ui/controls.js";
import { Appearance } from "./character/appearance.js";
import { CharacterStore } from "./character-store.js";
import { CreatorScreen } from "./ui/creator-screen.js";
import { GameScreen } from "./game/game-screen.js";
import { GraphicsSettings } from "./engine/graphics-settings.js";
import { MaterialLibrary } from "./engine/materials.js";
import { Renderer } from "./engine/renderer.js";
import { WorldAtlas } from "./engine/world-atlas.js";

export class App
{
    constructor(container, storage, assets)
    {
        this.container = container;
        this.assets = assets;
        this.store = new CharacterStore(storage);
        this.renderer = new Renderer(container);
        this.graphics = new GraphicsSettings(this.renderer);

        const saved = this.store.load();

        this.appearance = new Appearance(saved ?? {});
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
            this.materials = new MaterialLibrary(await WorldAtlas.load(this.assets));
        }
        finally
        {
            loading.remove();
        }

        this.creator = new CreatorScreen(
            this.container,
            this.materials,
            this.graphics,
            (draft) => this.confirmCreator(draft),
            () => this.showGame(),
        );

        this.showCreator("create");
        this.renderer.start();
        this.isReady = true;
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
            this.game = new GameScreen(this.container, this.renderer.canvas, this.appearance, this.materials, this.graphics, () => this.showCreator("edit"));
        }

        this.renderer.setScreen(this.game);
    }
}
