import * as Controls from "../ui/controls.js";
import * as FineMesher from "../render/fine-mesher.js";
import * as THREE from "three";
import { ZoneView } from "../render/zone-view.js";

const FINE = FineMesher.FINE;
const SCALE = 6;
const FINE_SIZE = SCALE / (FINE * 3);
const ACTIONS = [["add", "Add"], ["remove", "Remove"], ["paint", "Paint"], ["light", "Light"]];
const SIZES = [[1, "1"], [3, "3×3"], [5, "5×5"]];
const COLOURS = { add: "#7fd36b", remove: "#e0604a", paint: "#7fb3d5", light: "#f0c050" };
const BACKGROUND = "#2b2e34";
const VIEW = { back: 1.6, rise: 0.9, pitch: 0.42 };


/******************************************************************************/
/* BENCH                                                                      */
/******************************************************************************/

// The bench shows one object SCALE times its size on a plain floor under even
// light, and edits its fine cubes. Its own history holds each click until the
// object is saved.
export class Bench
{
    constructor(editor)
    {
        this.editor = editor;
        this.scene = new THREE.Scene();
        this.group = new THREE.Group();
        this.ghost = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.35, depthWrite: false }));
        this.lightMarks = new THREE.Group();
        this.floor = null;
        this.mesh = null;
        this.id = null;
        this.grid = null;
        this.history = [];
        this.future = [];
        this.action = "add";
        this.size = 1;
        this.isMirrored = false;
        this.target = null;

        this.scene.background = new THREE.Color(BACKGROUND);
        this.scene.add(new THREE.HemisphereLight("#e6e8ec", "#4a443c", 2.2), this.group, this.ghost, this.lightMarks);
        this.addSun();
        this.group.scale.setScalar(SCALE);
        this.ghost.visible = false;
    }

    addSun()
    {
        const sun = new THREE.DirectionalLight("#fff6e8", 1.6);

        sun.position.set(4, 10, 7);
        this.scene.add(sun);
    }

    get name()
    {
        return "bench";
    }

    get isOpen()
    {
        return this.id !== null;
    }

    get isDirty()
    {
        return this.history.length > 0;
    }

    /* OPEN AND CLOSE *********************************************************/

    // Returns false for an object the game does not know.
    open(id)
    {
        const object = this.editor.content.objects[id];

        if(!object) { return false; }

        const grid = FineMesher.decode(object);

        this.id = id;
        this.object = object;
        this.grid = { size: grid.size, palette: [...grid.palette], data: grid.data };
        this.lights = (object.lights ?? []).map((cell) => [...cell]);
        this.slice = grid.size[1];
        this.history = [];
        this.future = [];
        this.returnView = this.editor.fly.view;
        this.group.position.set(-grid.size[0] * FINE_SIZE / 2, 0, -grid.size[2] * FINE_SIZE / 2);
        this.placeFloor();
        this.build();

        const [width, height] = [grid.size[0], grid.size[1]].map((count) => count * FINE_SIZE);

        this.editor.fly.setView({ x: 0, y: height * VIEW.rise + 1, z: Math.max(width, height) * VIEW.back + 2, yaw: 0, pitch: VIEW.pitch });

        return true;
    }

    close()
    {
        this.editor.fly.setView(this.returnView);
        this.id = null;
        this.ghost.visible = false;
        this.mesh?.geometry.dispose();
        this.group.clear();
        this.mesh = null;
    }

    placeFloor()
    {
        const [width, , depth] = this.grid.size.map((count) => count / FINE);
        const cubes = Math.max(width, depth) + 4;

        if(this.floor) { this.scene.remove(this.floor); }

        this.floor = new THREE.GridHelper(cubes * FINE * FINE_SIZE, cubes, "#8a8478", "#4c4a46");
        this.floor.position.set(width % 2 === cubes % 2 ? 0 : FINE * FINE_SIZE / 2, 0, depth % 2 === cubes % 2 ? 0 : FINE * FINE_SIZE / 2);
        this.scene.add(this.floor);
    }

    // The mesh shows the fine cubes below the slice.
    build()
    {
        const [width, height, depth] = this.grid.size;
        const shown = this.grid.data.slice();

        shown.fill(0, this.slice * depth * width, height * depth * width);
        this.mesh?.geometry.dispose();
        this.group.clear();

        const geometry = ZoneView.objectGeometry({ cells: this.grid.size.map((count) => count / FINE), palette: this.grid.palette, runs: FineMesher.encode(shown) }, this.editor.screen.materials.atlas, this.editor.blocks);

        this.mesh = new THREE.Mesh(geometry, this.editor.screen.materials.world);
        this.group.add(this.mesh);
        this.markLights();
    }

    markLights()
    {
        this.lightMarks.clear();

        for(const [x, y, z] of this.lights)
        {
            const mark = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: COLOURS.light, depthTest: false }));

            mark.scale.setScalar(FINE * FINE_SIZE);
            mark.position.copy(this.toWorld([(x + 0.5) * FINE, (y + 0.5) * FINE, (z + 0.5) * FINE]));
            mark.renderOrder = 10;
            this.lightMarks.add(mark);
        }
    }

    toWorld([x, y, z])
    {
        return new THREE.Vector3(x * FINE_SIZE, y * FINE_SIZE, z * FINE_SIZE).add(this.group.position);
    }

    /* PANELS *****************************************************************/

    toolbar()
    {
        const actions = ACTIONS.map(([id, label]) => ({ label, isOn: this.action === id, action: "bench-" + id, onClick: () => this.set("action", id) }));
        const sizes = SIZES.map(([id, label]) => ({ label, isOn: this.size === id, action: "bench-size-" + id, onClick: () => this.set("size", id) }));
        const mirror = { label: "Mirror X", key: "M", isOn: this.isMirrored, action: "bench-mirror", onClick: () => this.set("isMirrored", !this.isMirrored) };
        const history =
        [
            { label: "Undo", key: "Ctrl+Z", isDisabled: this.history.length === 0, action: "bench-undo", onClick: () => this.undo() },
            { label: "Redo", key: "Ctrl+Y", isDisabled: this.future.length === 0, action: "bench-redo", onClick: () => this.redo() },
        ];
        const files =
        [
            { label: "Save object", key: "Ctrl+S", isDisabled: !this.isDirty, action: "bench-save", onClick: () => this.editor.saveObject() },
            { label: "Back to the world", key: "B", action: "bench-back", onClick: () => this.editor.closeBench() },
        ];

        return { modes: [{ label: "Bench: " + this.id, isOn: true, action: "bench" }], globals: [history, files], tools: actions, options: [{ label: "Size", items: sizes }, { items: [mirror] }] };
    }

    palette()
    {
        return { ...this.editor.tools.cubes.palette(), hint: "Middle-click a fine cube to pick its block. Light marks the cube that holds the clicked fine cube as a light." };
    }

    inspector()
    {
        const [width, height, depth] = this.grid.size;
        const slice = Controls.element("input", "editor-slider");
        const field = Controls.element("label", "editor-field");

        slice.type = "range";
        slice.min = 1;
        slice.max = height;
        slice.value = this.slice;
        slice.dataset.key = "slice";
        slice.addEventListener("input", () => this.setSlice(Number(slice.value)));
        field.append(Controls.element("span", "", "Slice: " + this.slice + " of " + height), slice);

        return {
            title: "Object: " + this.id,
            detail: "The bench edits every copy of the object at once, once it is saved.",
            rows:
            [
                ["Cells", [width, height, depth].map((count) => count / FINE).join(" × ")],
                ["Fine cubes", [width, height, depth].join(" × ")],
                ["Solid", this.object.isSolid === false ? "no" : "yes"],
                ["Lights", String(this.lights.length)],
            ],
            content: [field],
        };
    }

    set(key, value)
    {
        this[key] = value;
        this.editor.redraw();
    }

    setSlice(slice)
    {
        this.slice = slice;
        this.build();
        this.editor.redraw();
    }

    /* POINTER ****************************************************************/

    // The fine cube under the pointer, as { cell, normal }, or the floor's
    // place under it with a cell below the floor and an upward normal.
    hitAt(x, y)
    {
        const { origin, direction } = this.editor.ray(x, y);
        const start = origin.clone().sub(this.group.position).divideScalar(FINE_SIZE);
        const hit = Bench.march(this.grid, this.slice, start, direction);

        if(hit || direction.y >= 0) { return hit; }

        const along = -start.y / direction.y;
        const cell = [Math.floor(start.x + direction.x * along), -1, Math.floor(start.z + direction.z * along)];

        return cell[0] >= 0 && cell[2] >= 0 && cell[0] < this.grid.size[0] && cell[2] < this.grid.size[2] ? { cell, normal: [0, 1, 0] } : null;
    }

    // The first filled fine cube below `slice` along a ray from `start` in
    // fine cubes, with the face it entered by as `normal`, or null. Steps cube
    // by cube through the grid (Amanatides and Woo, "A Fast Voxel Traversal
    // Algorithm", 1987).
    static march({ size, data }, slice, start, direction)
    {
        const from = [start.x, start.y, start.z];
        const along = [direction.x, direction.y, direction.z];
        let [near, far, axis] = [0, Infinity, -1];

        for(let a = 0; a < 3; a++)
        {
            if(Math.abs(along[a]) < 1e-12)
            {
                if(from[a] < 0 || from[a] > size[a]) { return null; }

                continue;
            }

            const [t0, t1] = [(0 - from[a]) / along[a], (size[a] - from[a]) / along[a]].sort((p, q) => p - q);

            if(t0 > near) { [near, axis] = [t0, a]; }

            far = Math.min(far, t1);
        }

        if(near > far) { return null; }

        const cell = from.map((value, a) => Math.min(size[a] - 1, Math.max(0, Math.floor(value + along[a] * (near + 1e-9)))));
        const step = along.map(Math.sign);
        const next = cell.map((value, a) => (step[a] === 0 ? Infinity : ((value + (step[a] > 0 ? 1 : 0)) - from[a]) / along[a]));
        let normal = axis >= 0 ? [0, 1, 2].map((a) => (a === axis ? -step[a] : 0)) : null;

        while(cell.every((value, a) => value >= 0 && value < size[a]))
        {
            if(cell[1] < slice && data[(cell[1] * size[2] + cell[2]) * size[0] + cell[0]] > 0) { return { cell: [...cell], normal }; }

            const a = next[0] < next[1] ? (next[0] < next[2] ? 0 : 2) : (next[1] < next[2] ? 1 : 2);

            cell[a] += step[a];
            next[a] += Math.abs(1 / along[a]);
            normal = [0, 1, 2].map((b) => (b === a ? -step[a] : 0));
        }

        return null;
    }

    hover(hit)
    {
        this.target = hit ? this.cellsOf(hit) : null;

        if(!this.target || this.target.length === 0)
        {
            this.ghost.visible = false;
            return;
        }

        const low = [0, 1, 2].map((a) => Math.min(...this.target.map((cell) => cell[a])));
        const high = [0, 1, 2].map((a) => Math.max(...this.target.map((cell) => cell[a])) + 1);

        this.ghost.material.color.set(COLOURS[this.action]);
        this.ghost.scale.set(...[0, 1, 2].map((a) => (high[a] - low[a]) * FINE_SIZE + 0.01));
        this.ghost.position.copy(this.toWorld([0, 1, 2].map((a) => (low[a] + high[a]) / 2)));
        this.ghost.visible = true;
    }

    // The fine cubes a click acts on: a square across the face, on the face
    // for Add and the cubes themselves otherwise, and their mirror in x.
    cellsOf({ cell, normal })
    {
        const isAdding = this.action === "add";
        const middle = isAdding ? cell.map((value, a) => value + normal[a]) : cell;
        const reach = (this.size - 1) / 2;
        const cells = [];

        if(this.action === "light") { return cell[1] < 0 ? [] : [cell]; }

        for(let u = -reach; u <= reach; u++)
        {
            for(let v = -reach; v <= reach; v++)
            {
                const offsets = normal[0] !== 0 ? [0, u, v] : normal[1] !== 0 ? [u, 0, v] : [u, v, 0];

                cells.push(middle.map((value, a) => value + offsets[a]));
            }
        }

        const mirrored = this.isMirrored ? cells.map(([x, y, z]) => [this.grid.size[0] - 1 - x, y, z]) : [];

        return [...cells, ...mirrored].filter((c) => c.every((value, a) => value >= 0 && value < this.grid.size[a]) && (isAdding || this.filled(c)));
    }

    filled([x, y, z])
    {
        return this.grid.data[this.index([x, y, z])] > 0;
    }

    index([x, y, z])
    {
        return (y * this.grid.size[2] + z) * this.grid.size[0] + x;
    }

    click()
    {
        if(!this.target || this.target.length === 0) { return; }

        if(this.action === "light")
        {
            this.toggleLight(this.target[0].map((value) => Math.floor(value / FINE)));
            return;
        }

        const block = this.action === "remove" ? 0 : this.paletteIndex(this.editor.blocks.block(this.editor.tools.cubes.block).id);
        const changes = [];

        for(const cell of this.target)
        {
            const at = this.index(cell);
            const old = this.grid.data[at];
            const isChanged = this.action === "add" ? old === 0 : old !== block;

            if(isChanged && !changes.some(([index]) => index === at)) { changes.push([at, old, block]); }
        }

        if(changes.length > 0) { this.record({ changes }); }
    }

    // The middle button picks the block of the fine cube under the pointer.
    pick(hit)
    {
        const id = hit && hit.cell[1] >= 0 ? this.grid.palette[this.grid.data[this.index(hit.cell)]] : null;

        if(id) { this.editor.tools.cubes.choose(this.editor.blocks.number(id)); }
    }

    paletteIndex(id)
    {
        if(!this.grid.palette.includes(id)) { this.grid.palette.push(id); }

        return this.grid.palette.indexOf(id);
    }

    toggleLight(cell)
    {
        const lights = this.lights.some((light) => light.every((value, a) => value === cell[a])) ? this.lights.filter((light) => !light.every((value, a) => value === cell[a])) : [...this.lights, cell];

        this.record({ lights: [this.lights, lights] });
    }

    wheel(factor)
    {
        this.editor.tools.cubes.wheel(factor);
    }

    key(code)
    {
        if(code !== "KeyM") { return false; }

        this.isMirrored = !this.isMirrored;

        return true;
    }

    /* HISTORY ****************************************************************/

    // A step holds `changes`, [index, old, new] fine cubes, or `lights`, the
    // lists before and after.
    record(step)
    {
        this.history.push(step);
        this.future = [];
        this.apply(step, 1);
    }

    undo()
    {
        const step = this.history.pop();

        if(!step) { return; }

        this.future.push(step);
        this.apply(step, 0);
    }

    redo()
    {
        const step = this.future.pop();

        if(!step) { return; }

        this.history.push(step);
        this.apply(step, 1);
    }

    // `side` 0 undoes the step and 1 does it.
    apply(step, side)
    {
        for(const [at, old, block] of step.changes ?? []) { this.grid.data[at] = side === 1 ? block : old; }

        if(step.lights) { this.lights = step.lights[side]; }

        this.build();
        this.editor.redraw();
    }

    // The object as its data file holds it, with unused blocks dropped from
    // the palette.
    data()
    {
        const used = [...new Set(this.grid.data)].filter((entry) => entry > 0).sort((a, b) => a - b);
        const palette = [null, ...used.map((entry) => this.grid.palette[entry])];
        const renumber = new Uint8Array(this.grid.palette.length);

        used.forEach((entry, i) => { renumber[entry] = i + 1; });

        const data = { cells: this.grid.size.map((count) => count / FINE), palette, runs: FineMesher.encode(this.grid.data.map((entry) => renumber[entry])) };

        if(this.object.isSolid === false) { data.isSolid = false; }
        if(this.lights.length > 0) { data.lights = this.lights; }
        if(this.object.glow && this.lights.length > 0) { data.glow = this.object.glow; }

        return data;
    }
}
