import * as THREE from "three";
import { Actor } from "./actor.js";
import { Appearance } from "../character/appearance.js";
import { CameraRig } from "./camera-rig.js";
import { Hud } from "./hud.js";
import { Input } from "./input.js";
import { NpcBrain } from "./npc-brain.js";
import { Random } from "../util/random.js";
import { ZoneView } from "../render/zone-view.js";

const TALK_RANGE = 2.2;
const ORBIT_SPEED = 1.8;


/******************************************************************************/
/* GAME SCREEN                                                                */
/******************************************************************************/

export class GameScreen
{
    constructor(container, canvas, appearance, materials, graphics, onAppearance, content, zone)
    {
        this.library = appearance.library;
        this.materials = materials;
        this.content = content;
        this.onAppearance = onAppearance;
        this.size = { width: 1, height: 1 };
        this.zone = null;
        this.world = null;
        this.npcs = [];
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
        this.enterZone(zone);

        this.rig.yaw = 0;
        this.input.on("click", (x, y) => this.onClick(x, y));
        this.input.on("orbit", (dx, dy) => this.rig.orbit(-dx * 0.008, dy * 0.006));
        this.input.on("zoom", (factor) => this.rig.zoom(factor));
        this.input.on("key", (code) => this.onKey(code));
        appearance.onChange(() => this.hud.setPlayer(appearance));

        this.hud.setPlayer(appearance);
    }

    /* ZONES ******************************************************************/

    get actors()
    {
        return [this.player, ...this.npcs];
    }

    enterZone(zone)
    {
        if(this.zone) { this.leaveZone(); }

        this.zone = zone;
        this.world = new ZoneView(zone, this.content.prefabs, this.materials);
        this.player.placeAt(zone.spawn.x, zone.spawn.z, zone, zone.spawn.heading);
        this.world.scene.add(this.player.root);
        this.npcs = this.spawnPeople(zone.people);

        for(const line of zone.welcome) { this.hud.system(line); }
    }

    leaveZone()
    {
        for(const npc of this.npcs)
        {
            this.hud.forget(npc);
            npc.dispose();
        }

        this.npcs = [];
        this.pendingTalk = null;
        this.player.root.removeFromParent();
        this.world.dispose();
    }

    // The residents come first and the crowd after, from one random stream,
    // so a zone always gets the same villagers.
    spawnPeople(people)
    {
        const random = new Random(people.seed);
        const npcs = [];

        for(const placed of people.residents)
        {
            const npc = this.content.people.npcs[placed.npc];

            npcs.push(this.spawn(new Appearance(this.library, npc.look), { home: placed.home, roam: placed.roam, lines: npc.lines, role: npc.role }, random));
        }

        const crowd = people.crowd;

        for(let i = 0; i < (crowd?.count ?? 0); i++)
        {
            const angle = (i / crowd.count) * Math.PI * 2 + crowd.startAngle;
            const home = [crowd.centre[0] + Math.cos(angle) * crowd.radius, crowd.centre[1] + Math.sin(angle) * crowd.radius];
            const archetype = crowd.archetypes[i % crowd.archetypes.length] ?? undefined;
            const look = Appearance.randomData(this.library, random, { archetype });

            npcs.push(this.spawn(new Appearance(this.library, look), { home, roam: crowd.roam, lines: this.content.people.lines[crowd.lines] }, random));
        }

        return npcs;
    }

    spawn(appearance, resident, random)
    {
        const actor = new Actor(appearance);

        actor.brain = new NpcBrain(actor, resident, random);
        actor.placeAt(resident.home[0], resident.home[1], this.zone, random.range(0, Math.PI * 2));
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

        const hits = this.raycaster.intersectObjects([...this.world.terrainMeshes, this.world.water.mesh], false);

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

        for(const npc of this.npcs) { npc.brain.update(delta, this.zone); }
        for(const actor of this.actors) { actor.update(delta, this.zone); }

        this.rig.update(delta, this.player.position, this.player.measures.focus, (x, z) => this.zone.heightAt(x, z));
        this.world.update(delta, this.camera, this.player.position);
        this.hud.update(delta, this.camera, this.actors, this.player, this.size);
    }

    render(webgl)
    {
        webgl.render(this.world.scene, this.camera);
    }
}
