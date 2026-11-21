import { Appearance } from "./character/appearance.js";
import { CharacterStore } from "./character-store.js";
import { CreatorScreen } from "./ui/creator-screen.js";
import { GameScreen } from "./game/game-screen.js";
import { GraphicsSettings } from "./engine/graphics-settings.js";
import { MaterialLibrary } from "./engine/materials.js";
import { Renderer } from "./engine/renderer.js";

export class App
{
    constructor(container, storage)
    {
        this.container = container;
        this.store = new CharacterStore(storage);
        this.materials = new MaterialLibrary();
        this.renderer = new Renderer(container);
        this.graphics = new GraphicsSettings(this.renderer);

        const saved = this.store.load();

        this.appearance = new Appearance(saved ?? {});
        this.game = null;
        this.isReady = false;

        this.creator = new CreatorScreen(
            container,
            this.materials,
            this.graphics,
            (draft) => this.confirmCreator(draft),
            () => this.showGame(),
        );
    }

    start()
    {
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
