import * as Residents from "./residents.js";
import * as THREE from "three";
import { Actor } from "./actor.js";
import { Appearance } from "../character/appearance.js";
import { CameraRig } from "./camera-rig.js";
import { Hud } from "./hud.js";
import { Input } from "./input.js";
import { NpcBrain } from "./npc-brain.js";
import { Random } from "../util/random.js";
import { World } from "../world/world.js";

const TALK_RANGE = 2.2;
const SPAWN = { x: 1.6, z: 9.5 };
const VILLAGER_COUNT = 7;
const ORBIT_SPEED = 1.8;


/******************************************************************************/
/* GAME SCREEN                                                                */
/******************************************************************************/

export class GameScreen
{
    constructor(container, canvas, appearance, materials, graphics, onAppearance)
    {
        this.onAppearance = onAppearance;
        this.size = { width: 1, height: 1 };
        this.world = new World(materials, 7);
        this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 500);
        this.rig = new CameraRig(this.camera);
        this.input = new Input(canvas);
        this.raycaster = new THREE.Raycaster();
        this.pendingTalk = null;

        this.hud = new Hud(container, graphics,
        {
            onToggleRun: () => this.toggleRun(),
            onAppearance: () => this.onAppearance(),
        });

        this.player = new Actor(appearance);
        this.player.placeAt(SPAWN.x, SPAWN.z, this.world, Math.PI);
        this.world.scene.add(this.player.root);
        this.npcs = this.spawnResidents();
        this.actors = [this.player, ...this.npcs];

        this.rig.yaw = 0;
        this.input.on("click", (x, y) => this.onClick(x, y));
        this.input.on("orbit", (dx, dy) => this.rig.orbit(-dx * 0.008, dy * 0.006));
        this.input.on("zoom", (factor) => this.rig.zoom(factor));
        this.input.on("key", (code) => this.onKey(code));
        appearance.onChange(() => this.hud.setPlayer(appearance));

        this.hud.setPlayer(appearance);
        this.hud.system("Welcome to Hearthmere. Click the ground to walk, or click a villager to talk.");
        this.hud.system("Mirelle the tailor can change your appearance.");
    }

    spawnResidents()
    {
        const random = new Random(4242);
        const npcs = [];

        for(const resident of Residents.RESIDENTS)
        {
            npcs.push(this.spawn(new Appearance(resident.look), resident, random));
        }

        for(let i = 0; i < VILLAGER_COUNT; i++)
        {
            const angle = (i / VILLAGER_COUNT) * Math.PI * 2 + 0.3;
            const resident = { home: [Math.cos(angle) * 11, Math.sin(angle) * 11], roam: 9, lines: Residents.VILLAGER_LINES };
            const look = Appearance.randomData(random, { archetype: i % 3 === 0 ? undefined : "villager" });

            npcs.push(this.spawn(new Appearance(look), resident, random));
        }

        return npcs;
    }

    spawn(appearance, resident, random)
    {
        const actor = new Actor(appearance);

        actor.brain = new NpcBrain(actor, resident, random);
        actor.placeAt(resident.home[0], resident.home[1], this.world, random.range(0, Math.PI * 2));
        this.world.scene.add(actor.root);

        return actor;
    }

    /* INPUT ******************************************************************/

    onClick(x, y)
    {
        const pointer = new THREE.Vector2((x / this.size.width) * 2 - 1, -(y / this.size.height) * 2 + 1);

        this.raycaster.setFromCamera(pointer, this.camera);

        const npc = this.pickNpc();

        if(npc)
        {
            this.pendingTalk = npc;
            this.player.moveTo(npc.position);

            return;
        }

        const hits = this.raycaster.intersectObjects([this.world.terrainMesh, this.world.water.mesh], false);

        if(hits.length === 0) { return; }

        this.pendingTalk = null;
        this.player.moveTo(hits[0].point);
        this.hud.marker(x, y);
    }

    pickNpc()
    {
        const hits = this.raycaster.intersectObjects(this.npcs.map((npc) => npc.root), true);

        for(const hit of hits)
        {
            let node = hit.object;

            while(node && !node.userData.actor) { node = node.parent; }

            if(node) { return node.userData.actor; }
        }

        return null;
    }

    onKey(code)
    {
        if(code === "KeyR") { this.toggleRun(); }

        if(code === "KeyE")
        {
            this.player.animator.wave();
            this.hud.say(this.player.name, "waves.");
        }
    }

    toggleRun()
    {
        this.player.setRunning(!this.player.isRunning);
        this.hud.setRunning(this.player.isRunning);
    }

    steerFromKeys(delta)
    {
        const input = this.input;
        const forward = this.rig.groundForward();
        const right = new THREE.Vector2(-forward.y, forward.x);
        const move = new THREE.Vector2();

        if(input.isDown("KeyW")) { move.add(forward); }
        if(input.isDown("KeyS")) { move.sub(forward); }
        if(input.isDown("KeyD")) { move.add(right); }
        if(input.isDown("KeyA")) { move.sub(right); }

        if(move.lengthSq() > 0)
        {
            this.pendingTalk = null;
            this.player.steer(move.x, move.y);
        }
        else if(this.player.direction.lengthSq() > 0)
        {
            this.player.stop();
        }

        if(input.isDown("ArrowLeft")) { this.rig.orbit(-ORBIT_SPEED * delta, 0); }
        if(input.isDown("ArrowRight")) { this.rig.orbit(ORBIT_SPEED * delta, 0); }
        if(input.isDown("ArrowUp")) { this.rig.orbit(0, ORBIT_SPEED * 0.5 * delta); }
        if(input.isDown("ArrowDown")) { this.rig.orbit(0, -ORBIT_SPEED * 0.5 * delta); }
    }

    /* TALKING ****************************************************************/

    updateTalk()
    {
        const npc = this.pendingTalk;

        if(!npc) { return; }

        if(this.player.distanceTo(npc) > TALK_RANGE)
        {
            if(!this.player.target) { this.player.moveTo(npc.position); }

            return;
        }

        this.pendingTalk = null;
        this.player.stop();
        this.player.face(npc.position);

        const line = npc.brain.greet(this.player);

        this.hud.say(npc.name, line);
        this.hud.bubble(npc, line);

        if(npc.brain.role === "tailor") { this.onAppearance(); }
    }

    /* SCREEN *****************************************************************/

    show()
    {
        this.input.attach();
        this.hud.show();
    }

    hide()
    {
        this.input.detach();
        this.hud.hide();
        this.player.stop();
    }

    resize(width, height)
    {
        this.size = { width, height };
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
    }

    update(delta)
    {
        this.steerFromKeys(delta);
        this.updateTalk();

        for(const npc of this.npcs) { npc.brain.update(delta, this.world); }
        for(const actor of this.actors) { actor.update(delta, this.world); }

        this.rig.update(delta, this.player.position, (x, z) => this.world.heightAt(x, z));
        this.world.update(delta, this.camera, this.player.position);
        this.hud.update(delta, this.camera, this.actors, this.player, this.size);
    }

    render(webgl)
    {
        webgl.render(this.world.scene, this.camera);
    }
}
