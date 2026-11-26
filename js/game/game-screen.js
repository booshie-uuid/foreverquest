import * as CubeMesher from "../render/cube-mesher.js";
import * as THREE from "three";
import { CameraRig } from "./camera-rig.js";
import { ChunkWorkers } from "../render/chunk-workers.js";
import { EditMode } from "../editor/edit-mode.js";
import { EntityView } from "../render/entity-view.js";
import { Hud } from "./hud.js";
import { Input } from "./input.js";
import { Simulation } from "../sim/simulation.js";
import { ZoneData } from "../sim/zone-data.js";
import { ZoneView } from "../render/zone-view.js";

const ORBIT_SPEED = 1.8;
const MAX_TICKS_PER_FRAME = 5;
const EYE_HEIGHT = 0.93;
const INSPECT_RANGE = 60;


/******************************************************************************/
/* GAME SCREEN                                                                */
/******************************************************************************/

export class GameScreen
{
    // `onTravel(id)` takes the player to another zone.
    constructor(container, canvas, appearance, materials, graphics, onAppearance, content, streamer, onTravel)
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
            onTravel,
        }, content.zones);

        this.editMode = new EditMode(this, container);

        const editing = () => this.editMode.isActive;

        this.unsubscribers =
        [
            this.sim.onEvent((event) => this.onEvent(event)),
            graphics.onChange(() => this.applyGraphics()),
            appearance.onChange(() => this.hud.setPlayer(appearance)),
            this.input.on("click", (x, y) => (editing() ? this.editMode.click(x, y) : this.onClick(x, y))),
            this.input.on("inspect", (x, y) => this.onInspect(x, y)),
            this.input.on("pick", (x, y) => { if(editing()) { this.editMode.pick(x, y); } }),
            this.input.on("hover", (x, y) => { if(editing()) { this.editMode.hover(x, y); } }),
            this.input.on("orbit", (dx, dy) => (editing() ? this.editMode.look(dx, dy) : this.rig.orbit(-dx * 0.008, dy * 0.006))),
            this.input.on("zoom", (factor) => (editing() ? this.editMode.wheel(factor) : this.rig.zoom(factor))),
            this.input.on("stroke", (phase, x, y) => { if(editing()) { this.editMode.stroke(phase, x, y); } }),
            this.input.on("key", (code, event) => this.onKey(code, event)),
        ];

        this.input.setStrokeTest(() => editing() && this.editMode.wantsStrokes);
        this.graphics = graphics;
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

        this.editMode?.close();

        if(this.world) { this.leaveZone(); }

        this.streamer = streamer;
        this.sim.enter(zone);
        this.world = new ZoneView(zone, this.materials, this.workers, this.content.objects);

        this.syncViews();
        this.applyGraphics();
        this.hud.setZone(zone.id);

        for(const line of zone.welcome) { this.hud.system(line); }
    }

    syncViews()
    {
        const ids = new Set(this.sim.entities.map((entity) => entity.id));

        for(const [id, view] of this.views)
        {
            if(ids.has(id)) { continue; }

            this.hud.forget(view);
            view.dispose();
            this.views.delete(id);
        }

        for(const entity of this.sim.entities.filter((each) => !this.views.has(each.id)))
        {
            const view = new EntityView(entity, this.materials, this.content.blocks);

            this.views.set(entity.id, view);
            this.world.scene.add(view.root);
        }
    }

    applyGraphics()
    {
        this.world.setDaylight(this.graphics.isDay);
        this.materials.setGrid(this.graphics.isGrid);
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

        if(event.type === "woke")
        {
            view?.act("wake");
            this.hud.system("The " + event.name + " stirs.");
        }

        if(event.type === "shoved")
        {
            view?.act("shove");
            this.hud.system("The " + event.name + " shoves you back.");
        }
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

        const lever = this.pickLever();

        if(lever !== null) { this.sim.command({ type: "use", object: lever }); }
    }

    // The index in the zone's objects of the lever under the pointer, when
    // no solid cell outside the lever's own box is in front of it, or null.
    pickLever()
    {
        const isLever = (hit) => this.world.objectOf(hit.object, hit.instanceId)?.trigger?.lever;
        const meshes = [...this.world.objectMeshes.values()].filter((mesh) => mesh.userData.entries.some((entry) => entry.trigger?.lever));
        const hit = this.raycaster.intersectObjects(meshes, false).find(isLever);

        if(!hit) { return null; }

        const entry = this.world.objectOf(hit.object, hit.instanceId);
        const [x0, y0, z0, x1, y1, z1] = entry.box;
        const isInFront = (x, y, z) => !(x >= x0 && x <= x1 && y >= y0 && y <= y1 && z >= z0 && z <= z1) && this.zone.isSolid(x, y, z);
        const { origin, direction } = this.raycaster.ray;

        return this.zone.raycast(origin, direction, hit.distance, isInFront) >= hit.distance ? this.zone.objects.indexOf(entry) : null;
    }

    onInspect(x, y)
    {
        const pointer = new THREE.Vector2((x / this.size.width) * 2 - 1, -(y / this.size.height) * 2 + 1);

        this.raycaster.setFromCamera(pointer, this.camera);

        const npc = this.pickNpc();

        if(npc)
        {
            this.hud.system("That is " + npc.name + ".");
            return;
        }

        const { origin, direction } = this.raycaster.ray;
        const distance = this.zone.raycast(origin, direction, INSPECT_RANGE);

        if(distance >= INSPECT_RANGE)
        {
            this.hud.system("There is nothing there within reach.");
            return;
        }

        const point = origin.clone().addScaledVector(direction, distance + 0.01);
        const [column, row] = this.zone.columnOf(point.x, point.z);
        const cell = Math.floor(this.zone.cellY(point.y));
        const block = this.zone.blocks.block(this.zone.blockAt(column, cell, row))?.id ?? "nothing";
        const object = this.zone.objectAt(column, cell, row);
        const where = " (cell " + column + ", " + cell + ", " + row + ")";

        if(!object)
        {
            this.hud.system("That is " + block + " ground" + where + ".");
            return;
        }

        const [x0, y0, z0, x1, y1, z1] = object.box;
        const cubes = [x1 - x0 + 1, y1 - y0 + 1, z1 - z0 + 1];
        const size = cubes.join(" × ") + " cubes (" + cubes.map((count) => (count / ZoneData.CUBES_PER_METRE).toFixed(1)).join(" × ") + " m)";

        this.hud.system("That is prop " + object.prop + ": " + object.name + " at " + object.x.toFixed(1) + ", " + object.z.toFixed(1) + ", turned " + object.turns * 90 + "°, " + size + ", block " + block + where + ".");
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

    onKey(code, event)
    {
        if(this.editMode.isActive)
        {
            this.editMode.key(code, event);
            return;
        }

        if(code === "F8")
        {
            event?.preventDefault();
            this.editMode.enter();
            return;
        }

        if(code === "KeyR") { this.toggleRun(); }
        if(code === "KeyE") { this.sim.command({ type: "wave" }); }
    }

    toggleRun()
    {
        this.sim.command({ type: "run", isRunning: !this.player.isRunning });
    }

    // Sends a command when the keys change, so a held key does not fill the
    // queue while the simulation is paused, and again whenever the player's
    // steering does not match the keys once the queue is empty, as when a
    // command went missing.
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

        if(input.isDown("KeyW") || input.isHoldingBothButtons) { add(forward.x, forward.y); }
        if(input.isDown("KeyS")) { add(-forward.x, -forward.y); }
        if(input.isDown("KeyD")) { add(-forward.y, forward.x); }
        if(input.isDown("KeyA")) { add(forward.y, -forward.x); }

        const direction = this.player.direction;
        const isMatched = this.isPaused || this.sim.commands.length > 0 || (direction.x === move.x && direction.z === move.z);

        if(move.x !== this.steering.x || move.z !== this.steering.z || !isMatched)
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
        if(this.editMode.isActive)
        {
            this.updateEditing(delta);
            return;
        }

        this.steerFromKeys(delta);
        this.advance(delta);

        const alpha = this.isPaused ? 1 : this.accumulator / Simulation.TICK;
        const player = this.playerView;

        for(const view of this.views.values())
        {
            view.sync(alpha, delta);

            const light = this.world.lightAt(view.position);

            view.setLight(this.materials.colours(light.sky, light.lamp), light.glow, light.hue);
        }

        this.streamer.update(this.player.position.x, this.player.position.z);
        this.rig.update(delta, player.position, player.model.plan.height * EYE_HEIGHT, (origin, direction, distance) => this.zone.raycast(origin, direction, distance));
        player.root.visible = !this.rig.isFirstPerson;
        this.world.poseMovers(this.sim.movers.poses(alpha));
        this.world.update(delta, this.camera, player.position);
        this.hud.update(delta, this.camera, [...this.views.values()], player, this.size);
    }

    updateEditing(delta)
    {
        const focus = this.camera.position;

        this.editMode.update(delta);

        for(const view of this.views.values())
        {
            view.sync(1, 0);

            const light = this.world.lightAt(view.position);

            view.setLight(this.materials.colours(light.sky, light.lamp), light.glow, light.hue);
        }

        this.playerView.root.visible = true;
        this.streamer.update(focus.x, focus.z);
        this.world.update(delta, this.camera, focus);
    }

    render(webgl)
    {
        webgl.render(this.editMode.scene ?? this.world.scene, this.camera);
    }

    dispose()
    {
        for(const unsubscribe of this.unsubscribers) { unsubscribe(); }

        this.input.detach();
        this.editMode.dispose();
        this.leaveZone();
        this.workers.dispose();
        this.hud.dispose();
    }
}
