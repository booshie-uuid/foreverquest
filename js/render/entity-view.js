import * as THREE from "three";
import { CharacterModel } from "../character/character-model.js";
import { ClipPlayer } from "../kit/clip-player.js";

// Draws an entity between the last two ticks: `capture()` before each tick
// keeps the state the tick starts from, and `sync(alpha)` blends towards the
// entity's current state.
export class EntityView
{
    constructor(entity)
    {
        this.entity = entity;
        this.model = new CharacterModel(entity.appearance);
        this.clips = new ClipPlayer(this.model);
        this.position = new THREE.Vector3();
        this.heading = entity.heading;
        this.previous = null;

        this.model.root.userData.view = this;
        this.capture();
        this.sync(1, 0);
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
        this.clips.update(delta, this.entity.speed);
    }

    wave()
    {
        this.clips.wave();
    }

    dispose()
    {
        this.model.dispose();
    }
}
