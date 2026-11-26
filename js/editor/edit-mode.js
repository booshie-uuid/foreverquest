import * as Controls from "../ui/controls.js";
import * as RegionCodec from "../sim/region-codec.js";
import * as THREE from "three";
import { Bench } from "./bench.js";
import { BrushTool } from "./brush-tool.js";
import { CubeTool } from "./cube-tool.js";
import { EditorClient } from "./editor-client.js";
import { EditorPanel } from "./editor-panel.js";
import { FlyCamera } from "./fly-camera.js";
import { Marks } from "./marks.js";
import { MaterialLibrary } from "../engine/materials.js";
import { NoteTool } from "./note-tool.js";
import { Rehearsal } from "./rehearsal.js";
import { SelectTool } from "./select-tool.js";
import { TerrainTool } from "./terrain-tool.js";
import { ZoneData } from "../sim/zone-data.js";

const CUBES = ZoneData.CUBES_PER_METRE;
const RANGE = 90;
const SWATCH_SIZE = 16;
const NEW_ZONE = { sizes: [128, 256, 512, 1024], size: 1024, height: 60, pitch: 0.5 };


/******************************************************************************/
/* EDIT MODE                                                                  */
/******************************************************************************/

export class EditMode
{
    // `screen` is the game screen whose zone, view and camera the editor uses.
    constructor(screen, container)
    {
        this.screen = screen;
        this.panel = new EditorPanel(container);
        this.fly = new FlyCamera(screen.camera);
        this.blocks = screen.content.blocks;
        this.blockNumbers = [];
        this.blockGroups = [];
        this.swatches = new Map();
        this.client = null;
        this.marks = null;
        this.tools = null;
        this.tool = null;
        this.kinds = null;
        this.state = { isDirty: false, canUndo: false, canRedo: false, steps: 0, isLocked: true };
        this.pointer = null;
        this.hit = null;
        this.pending = null;
        this.isBusy = false;
        this.isActive = false;
        this.raycaster = new THREE.Raycaster();
        this.rehearsal = new Rehearsal();
        this.isShowingLight = false;

        for(let number = 1; number <= this.blocks.count; number++)
        {
            const block = this.blocks.block(number);

            if(block.kind === "object") { continue; }

            this.blockNumbers.push(number);

            if(!this.blockGroups.includes(block.group)) { this.blockGroups.push(block.group); }
        }
    }

    get zone()
    {
        return this.screen.zone;
    }

    get content()
    {
        return this.screen.content;
    }

    // The scene the screen draws: the bench's while it is open.
    get scene()
    {
        return this.bench?.isOpen ? this.bench.scene : null;
    }

    get wantsStrokes()
    {
        return this.isActive && this.tool === this.tools.brush;
    }

    /* ENTER AND LEAVE ********************************************************/

    // `view` sets the camera, as a note's link does; otherwise the camera
    // starts where it is.
    async enter(view = null)
    {
        if(this.isActive) { return; }

        if(!(await EditorClient.isAvailable(this.zone.id)))
        {
            this.screen.hud.system("The editor needs the development server: run npm start and open the game from it.");
            return;
        }

        this.client = new EditorClient(this.zone.id);

        try
        {
            this.state = await this.client.open();
        }
        catch(error)
        {
            this.screen.hud.system("The editor could not open " + this.zone.id + ": " + error.message);
            return;
        }

        this.isActive = true;
        this.kinds = this.state.kinds;
        this.marks = new Marks(this.screen.world.scene, this.zone);
        this.tools = { cubes: new CubeTool(this), select: new SelectTool(this), notes: new NoteTool(this), terrain: new TerrainTool(this), brush: new BrushTool(this) };
        this.bench = new Bench(this);
        this.tools.terrain.sync(this.state);
        this.tool = this.state.isLocked ? this.tools.cubes : this.tools.terrain;
        this.screen.pause();
        this.screen.hud.hide();
        this.panel.show();

        if(view) { this.fly.setView(view); }
        else { this.fly.takeOver(); }

        await this.tools.notes.load();
        this.redraw();
    }

    // The character lands where the camera looks, when that is in reach.
    leave()
    {
        if(!this.isActive) { return; }

        const forward = new THREE.Vector3();

        this.screen.camera.getWorldDirection(forward);

        const hit = this.zone.pick(this.screen.camera.position, forward, RANGE);
        const [x, z] = hit ? [(hit.cell[0] + 0.5) / CUBES - this.zone.half, (hit.cell[2] + 0.5) / CUBES - this.zone.half] : [this.fly.position.x, this.fly.position.z];

        this.screen.sim.player.placeAt(x, z, this.zone, this.fly.yaw);
        this.screen.rig.yaw = this.fly.yaw;
        this.close();
    }

    // Leaves without moving the character, as travel to another zone does.
    close()
    {
        if(!this.isActive) { return; }

        this.isActive = false;
        this.isShowingLight = false;
        this.showLight();
        this.rehearsal.stop();
        this.marks.dispose();
        this.marks = null;
        this.panel.setCard(null);
        this.panel.hide();
        this.screen.hud.show();
        this.screen.resume();
    }

    dispose()
    {
        this.close();
        this.panel.dispose();
    }

    setTool(name)
    {
        if(this.tools.select.capturing) { this.tools.select.startCapture(); }

        this.tool = this.tools[name];
        this.marks.hideGhost();
        this.marks.hideRing();
        this.redraw();
    }

    /* DRAWING ****************************************************************/

    redraw()
    {
        if(!this.isActive) { return; }

        if(this.bench.isOpen)
        {
            this.panel.setToolbar(this.bench.toolbar());
            this.panel.setPalette(this.bench.palette());
            this.panel.setInspector(this.bench.inspector());
            this.marks.hideOutline();
            this.marks.hideLinks();
            this.drawStatus();
            return;
        }

        const names = this.state.isLocked ? [["cubes", "Cubes", "1"], ["select", "Select", "2"], ["notes", "Note", "3"], ["brush", "Brush", "5"]] : [["terrain", "Terrain", "4"], ["select", "Select", "2"], ["notes", "Note", "3"]];
        const modes = names.map(([name, label, key]) => ({ label, key, isOn: this.tool.name === name, action: "mode-" + name, onClick: () => this.setTool(name) }));
        const history =
        [
            { label: "Undo", key: "Ctrl+Z", isDisabled: !this.state.canUndo, action: "undo", onClick: () => this.undo() },
            { label: "Redo", key: "Ctrl+Y", isDisabled: !this.state.canRedo, action: "redo", onClick: () => this.redo() },
            { label: "Grid", key: "G", isOn: this.screen.graphics.isGrid, action: "grid", onClick: () => this.screen.graphics.toggleGrid() },
            { label: "Day", key: "T", isOn: this.screen.graphics.isDay, action: "day", onClick: () => this.toggleDay() },
            { label: "Light levels", key: "L", isOn: this.isShowingLight, action: "light-levels", onClick: () => this.toggleLight() },
        ];
        const files =
        [
            { label: "Save", key: "Ctrl+S", isDisabled: !this.state.isDirty, action: "save", onClick: () => this.save() },
            { label: "New zone", action: "new-zone", onClick: () => this.showNewZone() },
            { label: "Play", key: "F8", action: "play", onClick: () => this.leave() },
        ];

        this.panel.setToolbar([modes, ...this.tool.toolbar(), history, files]);
        this.panel.setPalette(this.tool.palette());
        this.panel.setInspector(this.tool.inspector?.() ?? null);

        const selected = this.tools.select.entry;

        if(selected) { this.marks.showOutline(selected.box); }
        else { this.marks.hideOutline(); }

        if(selected) { this.marks.showLinks(selected.box, this.tools.select.linked().map((entry) => entry.box)); }
        else { this.marks.hideLinks(); }

        this.drawStatus();
    }

    drawStatus()
    {
        const parts = [];
        const hit = this.hit;

        if(hit && this.bench.isOpen)
        {
            parts.push("Fine cube " + hit.cell.join(", "), "Object " + this.bench.id);
        }
        else if(hit)
        {
            const [x, y, z] = hit.cell;
            const ground = this.zone.grounds[z * this.zone.columns + x];

            parts.push("Cell " + x + ", " + y + ", " + z, ((y + 1 - ground) / CUBES).toFixed(1) + " m above the ground", "Region " + this.zone.regionOfColumn(x, z), "Age " + this.zone.age(x, z));
        }

        parts.push(this.zone.name);

        const count = this.state.steps;

        this.panel.setStatus(parts, this.state.isDirty ? "● " + count + " change" + (count === 1 ? "" : "s") + " not saved" : "");
    }

    swatch(number)
    {
        if(this.swatches.has(number)) { return this.swatches.get(number); }

        const atlas = this.screen.materials.atlas;
        const layer = atlas.layer(this.blocks.block(number).faces.top);
        const canvas = document.createElement("canvas");
        const size = atlas.size;
        const bytes = size * size * 4;

        canvas.width = size;
        canvas.height = size;
        canvas.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(atlas.upload.subarray(layer * bytes, (layer + 1) * bytes)), size, size), 0, 0);

        const scaled = document.createElement("canvas");

        scaled.width = SWATCH_SIZE;
        scaled.height = SWATCH_SIZE;
        scaled.getContext("2d").drawImage(canvas, 0, 0, SWATCH_SIZE, SWATCH_SIZE);
        this.swatches.set(number, scaled.toDataURL());

        return this.swatches.get(number);
    }

    toggleDay()
    {
        this.screen.graphics.toggleDay();
        this.showLight();
        this.redraw();
    }

    toggleLight()
    {
        this.isShowingLight = !this.isShowingLight;
        this.showLight();
        this.redraw();
    }

    showLight()
    {
        const isDay = this.screen.graphics.isDay;
        const shown = isDay ? "brightest" : "lamp";

        this.screen.materials.setLightLevels(this.isShowingLight ? shown : null);
        this.panel.setLegend(this.isShowingLight ? { title: isDay ? "Sky or lamp level" : "Lamp level", colours: MaterialLibrary.LEVEL_COLOURS } : null);
    }

    // Plays the movers of `entries`, some of the zone's objects.
    play(entries)
    {
        const movers = this.screen.sim.movers;

        this.rehearsal.start(entries.map((entry) => movers.moverOf(entry)).filter(Boolean));
    }

    // The selected placement's name, for a note.
    selectedName()
    {
        const entry = this.tools.select.entry;

        return entry ? (entry.object ?? entry.name) + " (prop " + entry.prop + ")" : null;
    }

    /* POINTER ****************************************************************/

    ray(x, y)
    {
        const size = this.screen.size;

        this.raycaster.setFromCamera(new THREE.Vector2((x / size.width) * 2 - 1, -(y / size.height) * 2 + 1), this.screen.camera);

        return this.raycaster.ray;
    }

    pickCell(x, y)
    {
        const { origin, direction } = this.ray(x, y);

        return this.zone.pick(origin, direction, RANGE);
    }

    // Objects that are not solid have no cells, so only their meshes find them.
    pickObject(x, y)
    {
        this.ray(x, y);

        const hit = this.raycaster.intersectObjects([...this.screen.world.objectMeshes.values()], false)[0];
        const entry = hit ? this.screen.world.objectOf(hit.object, hit.instanceId) : null;

        return entry ? { entry, distance: hit.distance } : null;
    }

    hover(x, y)
    {
        this.pointer = { x, y };
    }

    // The target follows the click, which may come before a frame has
    // followed the pointer there.
    // The bench picks fine cubes; every other tool picks the zone's cells.
    hitAt(x, y)
    {
        return this.bench.isOpen ? this.bench.hitAt(x, y) : this.pickCell(x, y);
    }

    async click(x, y)
    {
        const hit = this.hitAt(x, y);

        this.pointer = { x, y };
        this.hit = hit;
        this.tool.hover(hit);
        await this.tool.click(hit, this.tool === this.tools.select ? this.pickObject(x, y) : null);
    }

    stroke(phase, x, y)
    {
        const hit = this.pickCell(x, y);

        this.pointer = { x, y };
        this.hit = hit;
        this.tool.hover(hit);
        this.tool.stroke?.(phase, hit);
    }

    pick(x, y)
    {
        this.tool.pick?.(this.hitAt(x, y));
    }

    wheel(factor)
    {
        this.tool.wheel(factor);
    }

    look(dx, dy)
    {
        this.fly.look(dx, dy);
    }

    key(code, event)
    {
        const isControl = event?.ctrlKey || event?.metaKey;
        const modes = this.state.isLocked ? { Digit1: "cubes", Digit2: "select", Digit3: "notes", Digit5: "brush" } : { Digit2: "select", Digit3: "notes", Digit4: "terrain" };

        if(this.bench.isOpen && this.benchKey(code, isControl))
        {
            event?.preventDefault();
            return;
        }

        if(code === "F8") { this.leave(); }
        else if(isControl && code === "KeyZ") { this.undo(); }
        else if(isControl && code === "KeyY") { this.redo(); }
        else if(isControl && code === "KeyS") { this.save(); }
        else if(this.tool.key(code, event)) { this.redraw(); }
        else if(modes[code] && !isControl) { this.setTool(modes[code]); }
        else if(code === "KeyG" && !isControl) { this.screen.graphics.toggleGrid(); }
        else if(code === "KeyT" && !isControl) { this.toggleDay(); }
        else if(code === "KeyL" && !isControl) { this.toggleLight(); }
        else { return; }

        event?.preventDefault();
    }

    // F8 does nothing while the bench is open.
    benchKey(code, isControl)
    {
        if(isControl && code === "KeyZ") { this.bench.undo(); }
        else if(isControl && code === "KeyY") { this.bench.redo(); }
        else if(isControl && code === "KeyS") { this.saveObject(); }
        else if(code === "KeyB" && !isControl) { this.closeBench(); }
        else if(this.bench.key(code)) { this.redraw(); }
        else { return code === "F8"; }

        return true;
    }

    update(delta)
    {
        this.fly.update(delta, this.screen.input);
        this.tool.update?.();

        if(this.rehearsal.isPlaying)
        {
            this.rehearsal.update(delta, this.zone);
            this.screen.world.poseMovers(this.screen.sim.movers.poses(1));
        }

        if(this.pointer)
        {
            this.hit = this.hitAt(this.pointer.x, this.pointer.y);
            this.tool.hover(this.hit);
            this.drawStatus();
        }

        this.panel.setPins(this.tools.notes.pins(this.screen.camera, this.screen.size));
    }

    /* CHANGES ****************************************************************/

    // Shows the cubes at once, then sends them; the server refuses those that
    // belong to a placement, which go back as they were. A brush has shown
    // its cells already, and gives `old`, the cells as they were.
    async placeCubes(cells, old = null)
    {
        if(!old)
        {
            old = cells.map(([x, y, z]) => [x, y, z, this.zone.blockAt(x, y, z)]);
            this.zone.setCells(cells);
        }

        const answer = await this.send([{ type: "cubes", cells }]);

        if(!answer) { this.zone.setCells(old); }
        if(!answer?.refused?.length) { return; }

        const refused = new Set(answer.refused.map(([x, y, z]) => x + "," + y + "," + z));
        const owner = answer.refused.find((cell) => cell[3] !== null)?.[3];
        const name = owner === undefined ? null : this.zone.objects[owner]?.name;

        this.zone.setCells(old.filter(([x, y, z]) => refused.has(x + "," + y + "," + z)));
        this.panel.say(name ? answer.refused.length + " cubes belong to " + name + ". Select it and break it apart to change them." : answer.refused.length + " cubes are outside the zone.");
    }

    // Moves of one placement while a change is on its way join into one.
    queueMove(move)
    {
        const pending = this.pending;

        if(pending && pending.prop === move.prop && pending.part === move.part)
        {
            pending.by = pending.by.map((value, axis) => value + move.by[axis]);
            pending.turns += move.turns;
        }
        else
        {
            if(pending) { this.send([{ type: "move", ...pending }]); }

            this.pending = { ...move };
        }

        this.flush();
    }

    async flush()
    {
        if(this.isBusy || !this.pending) { return; }

        const move = this.pending;

        this.pending = null;
        await this.send([{ type: "move", ...move }]);
        this.flush();
    }

    // Resolves to the server's answer, or null when it failed.
    async send(operations)
    {
        return this.run(() => this.client.apply(operations));
    }

    undo()
    {
        return this.run(() => this.client.undo());
    }

    redo()
    {
        return this.run(() => this.client.redo());
    }

    async save()
    {
        if(!this.state.isDirty) { return; }

        this.panel.say("Saving, then baking the assets…");

        const answer = await this.run(() => this.client.save());

        if(answer) { this.panel.say("Saved " + answer.written.length + " file" + (answer.written.length === 1 ? "" : "s") + " to content/."); }
    }

    // The page loads again at the camera's view, so the game's prefab and
    // object lists hold the new piece, and a new object opens in the bench;
    // the server keeps the zone's changes.
    async capture(capture)
    {
        this.panel.say("Capturing " + capture.id + ", then baking the assets…");

        const answer = await this.run(() => this.client.capture(capture));

        if(!answer) { return; }

        const { x, y, z, yaw, pitch } = this.fly.view;

        location.assign("?zone=" + this.zone.id + "&edit&view=" + [x, y, z, yaw, pitch].map((value) => Math.round(value * 100) / 100).join(",") + (capture.as === "object" ? "&bench=" + capture.id : ""));
    }

    /* BENCH ******************************************************************/

    openBench(id)
    {
        if(!this.bench.open(id))
        {
            this.panel.say("The game knows no object called " + id + ".");
            return;
        }

        this.tool = this.bench;
        this.marks.hideGhost();
        this.marks.hideRing();
        this.panel.say("The bench: " + id + ". B goes back to the world.");
        this.redraw();
    }

    // Leaving with changes not saved asks first.
    closeBench(isDiscarding = false)
    {
        if(this.bench.isDirty && !isDiscarding)
        {
            this.panel.setCard(
            {
                title: "Leave the bench?",
                text: "The changes to " + this.bench.id + " are not saved.",
                actions:
                [
                    { label: "Discard them", isWarning: true, action: "bench-discard", onClick: () => this.closeBench(true) },
                    { label: "Keep editing", action: "bench-keep", onClick: () => this.panel.setCard(null) },
                ],
            });
            return;
        }

        this.panel.setCard(null);
        this.bench.close();
        this.tool = this.tools.select;
        this.redraw();
    }

    // The page loads again at the world view, as after a capture, so every
    // copy of the object takes the saved fine cubes.
    async saveObject()
    {
        if(!this.bench.isDirty) { return; }

        const id = this.bench.id;

        this.panel.say("Saving " + id + ", then baking the assets…");

        const answer = await this.run(() => this.client.saveObject(id, this.bench.data()));

        if(!answer) { return; }

        const { x, y, z, yaw, pitch } = this.bench.returnView;

        location.assign("?zone=" + this.zone.id + "&edit&view=" + [x, y, z, yaw, pitch].map((value) => Math.round(value * 100) / 100).join(","));
    }

    async lockIn()
    {
        this.panel.say("Locking in the terrain, then baking the assets…");

        const answer = await this.run(() => this.client.lock());

        if(answer) { this.panel.say("Locked in: wrote " + answer.written.length + " files to content/. The terrain now changes cube by cube."); }
    }

    /* NEW ZONE ***************************************************************/

    showNewZone()
    {
        const id = Controls.element("input", "editor-search");
        const name = Controls.element("input", "editor-search");
        const size = Controls.element("select", "editor-choice");
        const field = (label, control) =>
        {
            const node = Controls.element("label", "editor-field");

            node.append(Controls.element("span", "", label), control);

            return node;
        };

        id.placeholder = "vale";
        id.dataset.key = "id";
        name.placeholder = "Hearthmere Vale";
        name.dataset.key = "name";

        for(const metres of NEW_ZONE.sizes)
        {
            const option = Controls.element("option", "", metres.toLocaleString() + " m");

            option.value = metres;
            size.append(option);
        }

        size.value = NEW_ZONE.size;
        this.panel.setCard(
        {
            title: "New zone",
            content: [field("Id", id), field("Name", name), field("Size", size), Controls.element("div", "editor-hint", "The terrain starts as rolling hills closed by cliffs, with " + this.zone.name + "'s lighting. Nothing is written to content/ until you save.")],
            actions:
            [
                { label: "Create", isOn: true, action: "new-zone-create", onClick: () => this.createZone(id.value.trim(), name.value.trim(), Number(size.value)) },
                { label: "Cancel", action: "new-zone-cancel", onClick: () => this.panel.setCard(null) },
            ],
        });
    }

    async createZone(id, name, size)
    {
        try
        {
            await new EditorClient(id).create({ name, size, from: this.zone.id });
        }
        catch(error)
        {
            this.panel.say(error.message);
            return;
        }

        location.assign("?zone=" + id + "&edit&view=0," + NEW_ZONE.height + "," + Math.round(size * 0.3) + ",0," + NEW_ZONE.pitch);
    }

    async run(request)
    {
        this.isBusy = true;

        try
        {
            const answer = await request();

            this.state = answer;
            this.tools.terrain.sync(answer);

            if(answer.isLocked && this.tool === this.tools.terrain) { this.tool = this.tools.cubes; }

            if(Array.isArray(answer.regions)) { await this.refresh(answer.regions); }
            for(const message of answer.messages ?? []) { this.panel.say(message); }

            return answer;
        }
        catch(error)
        {
            this.panel.say(error.message);

            return null;
        }
        finally
        {
            this.isBusy = false;
            this.redraw();
        }
    }

    async refresh(regions)
    {
        const source = this.screen.streamer.source;
        const id = this.zone.id;
        const index = await source.json("zones/" + id + "/index.json");
        const sides = index.waterSides ?? [];

        if(index.water !== this.zone.waterCell || sides.join() !== this.zone.waterSides.join()) { this.zone.setWater(index.water, sides); }

        this.zone.setBounds(index.bounds);

        for(const name of regions.filter((region) => this.zone.hasRegion(region)))
        {
            this.zone.replaceRegion({ name, ...RegionCodec.decode(await source.inflated("zones/" + id + "/" + name + ".bin")) });
        }

        this.rehearsal.stop();
        this.zone.setObjects(index.objects);
        this.screen.sim.reloadMovers();
    }
}
