import * as THREE from "three";
import { CharacterModel } from "../character/character-model.js";
import { ClipPlayer } from "../kit/clip-player.js";
import { ConstructModel } from "./construct-model.js";

const WAKE_SECONDS = 0.8;

// Draws an entity between the last two ticks: `capture()` before each tick
// keeps the state the tick starts from, and `sync(alpha)` blends towards the
// entity's current state.
export class EntityView
{
    // With `materials`, the character is lit by the cell it stands in. A
    // construct needs `materials` and the zone's `blocks`.
    constructor(entity, materials = null, blocks = null)
    {
        this.entity = entity;
        this.cell = { cellSky: { value: new THREE.Color() }, cellLamp: { value: new THREE.Color() }, cellGlow: { value: 0 }, cellLampHue: { value: 0 } };
        this.model = entity.construct ? new ConstructModel(entity.appearance, materials, blocks, this.cell) : new CharacterModel(entity.appearance, materials ? (material) => materials.shadeCharacter(material, this.cell) : null);
        this.clips = new ClipPlayer(this.model);
        this.asleep = this.isDormant ? 1 : 0;
        this.position = new THREE.Vector3();
        this.heading = entity.heading;
        this.previous = null;

        this.model.root.userData.view = this;
        this.capture();
        this.sync(1, 0);
    }

    // `glow` and `hue` are the cell's glow and its lamp light's colour as the
    // mesher packs them, or 0.
    setLight({ sky, lamp }, glow = 0, hue = 0)
    {
        this.cell.cellSky.value.copy(sky);
        this.cell.cellLamp.value.copy(lamp);
        this.cell.cellGlow.value = glow;
        this.cell.cellLampHue.value = hue;
    }

    get root()
    {
        return this.model.root;
    }

    get name()
    {
        return this.entity.name;
    }

    get measures()
    {
        return this.entity.measures;
    }

    get isDormant()
    {
        return this.entity.brain?.isDormant === true;
    }

    capture()
    {
        const { position, heading } = this.entity;

        this.previous = { x: position.x, y: position.y, z: position.z, heading };
    }

    sync(alpha, delta)
    {
        const from = this.previous;
        const to = this.entity.position;
        const turn = Math.atan2(Math.sin(this.entity.heading - from.heading), Math.cos(this.entity.heading - from.heading));

        this.position.set(from.x + (to.x - from.x) * alpha, from.y + (to.y - from.y) * alpha, from.z + (to.z - from.z) * alpha);
        this.heading = from.heading + turn * alpha;
        this.root.position.copy(this.position);
        this.root.rotation.y = this.heading;

        if(this.isDormant)
        {
            this.asleep = 1;
            this.model.pose(1);
            return;
        }

        this.clips.update(delta, this.entity.speed);
        this.asleep = Math.max(0, this.asleep - delta / WAKE_SECONDS);

        if(this.asleep > 0) { this.model.addDormant(this.asleep); }
    }

    wave()
    {
        this.clips.wave();
    }

    // Plays one of the rig's actions, such as a construct's wake or shove.
    act(name)
    {
        this.clips.play(name);
    }

    dispose()
    {
        this.model.dispose();
    }
}
