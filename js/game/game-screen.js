import * as CubeMesher from "../render/cube-mesher.js";
import * as THREE from "three";
import { CameraRig } from "./camera-rig.js";
import { ChunkWorkers } from "../render/chunk-workers.js";
import { EntityView } from "../render/entity-view.js";
import { Hud } from "./hud.js";
import { Input } from "./input.js";
import { Simulation } from "../sim/simulation.js";
import { ZoneView } from "../render/zone-view.js";

const ORBIT_SPEED = 1.8;
const MAX_TICKS_PER_FRAME = 5;


/******************************************************************************/
/* GAME SCREEN                                                                */
/******************************************************************************/

export class GameScreen
{
    constructor(container, canvas, appearance, materials, graphics, onAppearance, content, streamer)
    {
        this.materials = materials;
        this.content = content;
        this.onAppearance = onAppearance;
        this.size = { width: 1, height: 1 };
        this.world = null;
        this.streamer = null;
        this.workers = ChunkWorkers.forMachine(CubeMesher.faceTable(content.blocks, materials.atlas));
        this.views = new Map();
        this.accumulator = 0;
        this.isPaused = false;
        this.steering = { x: 0, z: 0 };
        this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 500);
        this.rig = new CameraRig(this.camera);
        this.input = new Input(canvas);
        this.raycaster = new THREE.Raycaster();
        this.sim = new Simulation(appearance.library, content.people);

        this.hud = new Hud(container, graphics,
        {
            onToggleRun: () => this.toggleRun(),
            onAppearance: () => this.onAppearance(),
        });

        this.unsubscribers =
        [
            this.sim.onEvent((event) => this.onEvent(event)),
            appearance.onChange(() => this.hud.setPlayer(appearance)),
            this.input.on("click", (x, y) => this.onClick(x, y)),
            this.input.on("orbit", (dx, dy) => this.rig.orbit(-dx * 0.008, dy * 0.006)),
            this.input.on("zoom", (factor) => this.rig.zoom(factor)),
            this.input.on("key", (code) => this.onKey(code)),
        ];

        this.sim.setPlayer(appearance);
        this.enterZone(streamer);
        this.hud.setPlayer(appearance);
    }

    get zone()
    {
        return this.sim.zone;
    }

    get player()
    {
        return this.sim.player;
    }

    get npcs()
    {
        return this.sim.npcs;
    }

    get playerView()
    {
        return this.views.get(this.player.id);
    }

    /* ZONES ******************************************************************/

    // The streamer has loaded the regions around the zone's spawn point.
    enterZone(streamer)
    {
        const zone = streamer.zone;

        if(this.world) { this.leaveZone(); }

        this.streamer = streamer;
        this.sim.enter(zone);
        this.world = new ZoneView(zone, this.content.prefabs, this.materials, this.workers);

        for(const entity of this.sim.entities)
        {
            const view = new EntityView(entity);

            this.views.set(entity.id, view);
            this.world.scene.add(view.root);
        }

        for(const line of zone.welcome) { this.hud.system(line); }
    }

    leaveZone()
    {
        for(const view of this.views.values())
        {
            this.hud.forget(view);
            view.dispose();
        }

        this.views.clear();
        this.world.dispose();
        this.world = null;
        this.streamer.dispose();
        this.streamer = null;
    }

    /* EVENTS *****************************************************************/

    onEvent(event)
    {
        const view = this.views.get(event.id);

        if(event.type === "waved")
        {
            view?.wave();

            if(event.id === this.player.id) { this.hud.say(this.player.name, "waves."); }
        }

        if(event.type === "said")
        {
            this.hud.say(event.name, event.line);
            this.hud.bubble(view, event.line);

            if(event.role === "tailor") { this.onAppearance(); }
        }

        if(event.type === "running") { this.hud.setRunning(event.isRunning); }
    }

    /* INPUT ******************************************************************/

    onClick(x, y)
    {
        const pointer = new THREE.Vector2((x / this.size.width) * 2 - 1, -(y / this.size.height) * 2 + 1);

        this.raycaster.setFromCamera(pointer, this.camera);

        const npc = this.pickNpc();

        if(npc)
        {
            this.sim.command({ type: "talk", id: npc.id });

            return;
        }

        const hits = this.raycaster.intersectObjects([...this.world.terrainMeshes, this.world.water.mesh], false);

        if(hits.length === 0) { return; }

        this.sim.command({ type: "moveTo", x: hits[0].point.x, z: hits[0].point.z });
        this.hud.marker(x, y);
    }

    pickNpc()
    {
        const roots = [...this.views.values()].filter((view) => view.entity !== this.player).map((view) => view.root);

        for(const hit of this.raycaster.intersectObjects(roots, true))
        {
            let node = hit.object;

            while(node && !node.userData.view) { node = node.parent; }

            if(node) { return node.userData.view.entity; }
        }

        return null;
    }

    onKey(code)
    {
        if(code === "KeyR") { this.toggleRun(); }
        if(code === "KeyE") { this.sim.command({ type: "wave" }); }
    }

    toggleRun()
    {
        this.sim.command({ type: "run", isRunning: !this.player.isRunning });
    }

    // Sends a command only when the keys change, so a held key does not fill
    // the queue while the simulation is paused.
    steerFromKeys(delta)
    {
        const input = this.input;
        const forward = this.rig.groundForward();
        const move = { x: 0, z: 0 };
        const add = (x, z) =>
        {
            move.x += x;
            move.z += z;
        };

        if(input.isDown("KeyW")) { add(forward.x, forward.y); }
        if(input.isDown("KeyS")) { add(-forward.x, -forward.y); }
        if(input.isDown("KeyD")) { add(-forward.y, forward.x); }
        if(input.isDown("KeyA")) { add(forward.y, -forward.x); }

        if(move.x !== this.steering.x || move.z !== this.steering.z)
        {
            const isSteering = move.x !== 0 || move.z !== 0;

            this.sim.command(isSteering ? { type: "steer", ...move } : { type: "stop" });
            this.steering = move;
        }

        if(input.isDown("ArrowLeft")) { this.rig.orbit(-ORBIT_SPEED * delta, 0); }
        if(input.isDown("ArrowRight")) { this.rig.orbit(ORBIT_SPEED * delta, 0); }
        if(input.isDown("ArrowUp")) { this.rig.orbit(0, ORBIT_SPEED * 0.5 * delta); }
        if(input.isDown("ArrowDown")) { this.rig.orbit(0, -ORBIT_SPEED * 0.5 * delta); }
    }

    /* TICKS ******************************************************************/

    runTick()
    {
        for(const view of this.views.values()) { view.capture(); }

        this.sim.tick();
    }

    pause()
    {
        this.isPaused = true;
        this.accumulator = 0;
    }

    resume()
    {
        this.isPaused = false;
    }

    stepTicks(count)
    {
        for(let i = 0; i < count; i++) { this.runTick(); }

        for(const view of this.views.values()) { view.sync(1, count * Simulation.TICK); }
    }

    // Catches up at most a few ticks each frame, so a slow frame slows the
    // game rather than freezing it.
    advance(delta)
    {
        if(this.isPaused) { return; }

        this.accumulator = Math.min(this.accumulator + delta, MAX_TICKS_PER_FRAME * Simulation.TICK);

        while(this.accumulator >= Simulation.TICK)
        {
            this.runTick();
            this.accumulator -= Simulation.TICK;
        }
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
        this.steering = { x: 0, z: 0 };
        this.sim.command({ type: "stop" });
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
        this.advance(delta);

        const alpha = this.isPaused ? 1 : this.accumulator / Simulation.TICK;
        const player = this.playerView;

        for(const view of this.views.values()) { view.sync(alpha, delta); }

        this.streamer.update(this.player.position.x, this.player.position.z);
        this.rig.update(delta, player.position, this.player.measures.focus, (x, z) => this.zone.heightAt(x, z));
        this.world.update(delta, this.camera, player.position);
        this.hud.update(delta, this.camera, [...this.views.values()], player, this.size);
    }

    render(webgl)
    {
        webgl.render(this.world.scene, this.camera);
    }

    dispose()
    {
        for(const unsubscribe of this.unsubscribers) { unsubscribe(); }

        this.input.detach();
        this.leaveZone();
        this.workers.dispose();
        this.hud.dispose();
    }
}
