import * as Controls from "../ui/controls.js";

const MAP_PIXELS = 380;
const HIT_PIXELS = 8;
const MIN_BOX = 8;
const CAMERA_STEP = 2;
const GOLD = "#e0b04a";
const PALE = "rgba(240, 236, 228, 0.8)";
const MIN_ABOVE = 4;
const HINTS =
{
    box: "Drag a box on the map.",
    line: "Click points on the map; double-click or press Enter to finish.",
    point: "Click the map where the pass starts; it cuts to the nearest edge.",
};


/******************************************************************************/
/* TERRAIN TOOL                                                               */
/******************************************************************************/

// `kinds` comes from the server's answer to open.
export class TerrainTool
{
    constructor(editor)
    {
        this.editor = editor;
        this.recipe = null;
        this.water = 0;
        this.applied = null;
        this.selected = -1;
        this.drawing = null;
        this.drag = null;
        this.mapRequest = 0;
        this.cameraMark = null;
        this.image = new Image();
        this.canvas = Controls.element("canvas", "editor-map");
        this.canvas.width = MAP_PIXELS;
        this.canvas.height = MAP_PIXELS;
        this.image.addEventListener("load", () => this.drawMap());
        this.canvas.addEventListener("pointerdown", (event) => this.onDown(event));
        this.canvas.addEventListener("pointermove", (event) => this.onMove(event));
        this.canvas.addEventListener("pointerup", () => this.onUp());
        this.canvas.addEventListener("dblclick", () => this.finishLine());
    }

    get name()
    {
        return "terrain";
    }

    get kinds()
    {
        return this.editor.kinds;
    }

    get size()
    {
        return this.editor.zone.size;
    }

    get isPreviewed()
    {
        return JSON.stringify({ recipe: this.recipe, water: this.water }) === this.applied;
    }

    // Takes the recipe the server holds whenever it differs from the one the
    // world last showed, as after an undo.
    sync(state)
    {
        if(state.recipe === undefined)
        {
            this.recipe = null;
            this.applied = null;
            return;
        }

        const applied = JSON.stringify({ recipe: state.recipe, water: state.water });

        if(applied === this.applied) { return; }

        this.applied = applied;
        this.recipe = structuredClone(state.recipe);
        this.water = state.water;
        this.selected = Math.min(this.selected, this.recipe.features.length - 1);
        this.drawing = null;
        this.refreshMap();
    }

    /* PANELS *****************************************************************/

    toolbar()
    {
        return [[
            { label: "New seed", action: "terrain-seed", isDisabled: this.recipe.base.seed === undefined, onClick: () => this.newSeed() },
            { label: "Preview", isOn: !this.isPreviewed, isDisabled: this.isPreviewed, action: "terrain-preview", onClick: () => this.preview() },
            { label: "Lock in", isWarning: true, isDisabled: !this.isPreviewed, action: "terrain-lock", onClick: () => this.confirmLock() },
        ]];
    }

    palette()
    {
        const content = [...this.baseFields(), ...this.edgeFields(), ...this.featureFields()];
        const hint = this.drawing ? HINTS[this.kinds.features[this.drawing.kind].shape] : (this.isPreviewed ? "The world shows this recipe." : "The map shows changes the world does not yet; Preview bakes them.");

        return { title: "Terrain", content, hint };
    }

    inspector()
    {
        return { title: "Map", content: [this.canvas], detail: "North is at the top. Click a feature to select it, and drag it to move it.", isWide: true };
    }

    baseFields()
    {
        const base = this.recipe.base;
        const bases = Object.entries(this.kinds.bases).map(([kind, { label }]) => [kind, label]);
        const fields = [Controls.element("h4", "", "Base"), choiceField("Kind", bases, base.kind, (kind) => this.setBase(kind))];

        for(const setting of this.kinds.bases[base.kind].settings) { fields.push(numberField(setting, base[setting.key], (value) => this.change(() => { base[setting.key] = value; }))); }

        fields.push(numberField(this.kinds.water, this.water, (value) => this.change(() => { this.water = value; })));

        return fields;
    }

    edgeFields()
    {
        const fields = [Controls.element("h4", "", "Edges")];
        const edges = Object.entries(this.kinds.edges).map(([kind, { label }]) => [kind, label]);

        for(const side of this.kinds.sides)
        {
            const edge = this.recipe.edges[side];

            fields.push(choiceField(side.charAt(0).toUpperCase() + side.slice(1), edges, edge.kind, (kind) => this.change(() => { this.recipe.edges[side] = { kind, ...defaultsOf(this.kinds.edges[kind].settings) }; })));

            for(const setting of this.kinds.edges[edge.kind].settings) { fields.push(numberField(setting, edge[setting.key], (value) => this.change(() => { edge[setting.key] = value; }), "is-indented")); }
        }

        return fields;
    }

    featureFields()
    {
        const fields = [Controls.element("h4", "", "Features, in order")];
        const adds = Controls.element("div", "editor-actions");

        this.recipe.features.forEach((feature, i) =>
        {
            const row = Controls.element("div", "editor-feature");
            const pick = Controls.button((i + 1) + " · " + this.kinds.features[feature.kind].label, () => this.select(i), "editor-item");
            const remove = Controls.button("✕", () => this.remove(i), "editor-item");

            pick.classList.toggle("is-on", i === this.selected);
            remove.title = "Remove";
            remove.dataset.action = "remove-feature";
            row.append(pick, remove);
            fields.push(row);
        });

        for(const [kind, { label }] of Object.entries(this.kinds.features))
        {
            const button = Controls.button("+ " + label, () => this.startDrawing(kind), "editor-button");

            button.classList.toggle("is-on", this.drawing?.kind === kind);
            button.dataset.action = "add-" + kind;
            adds.append(button);
        }

        fields.push(adds);

        const feature = this.recipe.features[this.selected];

        if(!feature) { return fields; }

        fields.push(Controls.element("h4", "", (this.selected + 1) + " · " + this.kinds.features[feature.kind].label));

        for(const setting of this.kinds.features[feature.kind].settings)
        {
            if(setting.when && feature[setting.when[0]] !== setting.when[1]) { continue; }

            const set = (value) => this.change(() => { feature[setting.key] = value; });

            fields.push(setting.choices ? choiceField(setting.label, setting.choices, feature[setting.key], set) : numberField(setting, feature[setting.key], set));
        }

        return fields;
    }

    /* TOOL EVENTS ************************************************************/

    hover()
    {
        this.editor.marks.hideGhost();
    }

    click()
    {
    }

    wheel()
    {
    }

    key(code)
    {
        if(code === "Escape" && this.drawing)
        {
            this.drawing = null;
            this.drawMap();
            return true;
        }

        if(code === "Enter" && this.drawing)
        {
            this.finishLine();
            return true;
        }

        if(code === "Delete" && this.selected >= 0)
        {
            this.remove(this.selected);
            return true;
        }

        return false;
    }

    update()
    {
        const { x, z } = this.editor.fly.position;

        if(this.cameraMark && Math.hypot(x - this.cameraMark.x, z - this.cameraMark.z) < CAMERA_STEP && this.cameraMark.yaw === this.editor.fly.yaw) { return; }

        this.drawMap();
    }

    /* CHANGES ****************************************************************/

    change(edit)
    {
        edit();
        this.refreshMap();
        this.editor.redraw();
    }

    setBase(kind)
    {
        const seed = this.recipe.base.seed;

        this.change(() => { this.recipe.base = { kind, ...defaultsOf(this.kinds.bases[kind].settings), ...(seed !== undefined && kind !== "flat" ? { seed } : {}) }; });
    }

    newSeed()
    {
        this.change(() => { this.recipe.base.seed = Math.floor(Math.random() * 100000); });
    }

    select(index)
    {
        this.selected = index;
        this.drawing = null;
        this.drawMap();
        this.editor.redraw();
    }

    remove(index)
    {
        this.change(() =>
        {
            this.recipe.features.splice(index, 1);
            this.selected = -1;
        });
    }

    startDrawing(kind)
    {
        this.drawing = this.drawing?.kind === kind ? null : { kind, points: [] };
        this.selected = -1;
        this.drawMap();
        this.editor.redraw();
    }

    add(feature)
    {
        this.drawing = null;
        this.change(() =>
        {
            this.recipe.features.push(feature);
            this.selected = this.recipe.features.length - 1;
        });
    }

    // A double click also clicks twice, so repeated points are dropped.
    finishLine()
    {
        const points = (this.drawing?.points ?? []).filter((point, k, all) => k === 0 || Math.hypot(point[0] - all[k - 1][0], point[1] - all[k - 1][1]) >= 1);

        if(this.kinds.features[this.drawing?.kind]?.shape !== "line" || points.length < 2) { return; }

        this.add({ kind: this.drawing.kind, ...defaultsOf(this.kinds.features[this.drawing.kind].settings), points });
    }

    async preview()
    {
        this.editor.panel.say("Baking the terrain…");
        await this.editor.send([{ type: "terrain", recipe: this.recipe, water: this.water }]);
    }

    confirmLock()
    {
        const text = Controls.element("div", "editor-note-body", "Lock in writes this terrain to content/zones/" + this.editor.zone.id + "/regions/ as cubes and saves the zone. The recipe is removed and cannot be run again; from then on the terrain changes cube by cube.");
        const close = () => this.editor.panel.setCard(null);

        this.editor.panel.setCard(
        {
            title: "Lock in the terrain?",
            content: [text],
            actions:
            [
                { label: "Lock in", isWarning: true, action: "terrain-lock-confirm", onClick: () => { close(); this.editor.lockIn(); } },
                { label: "Cancel", action: "terrain-lock-cancel", onClick: close },
            ],
        });
    }

    /* MAP ********************************************************************/

    // Answers that arrive after a later request are dropped.
    async refreshMap()
    {
        const request = ++this.mapRequest;

        try
        {
            const { map } = await this.editor.client.map(this.recipe, this.water);

            if(request === this.mapRequest) { this.image.src = map; }
        }
        catch(error)
        {
            if(request === this.mapRequest) { this.editor.panel.say(error.message); }
        }
    }

    toPixels(x, z)
    {
        return [(x / this.size + 0.5) * MAP_PIXELS, (z / this.size + 0.5) * MAP_PIXELS];
    }

    toMetres(event)
    {
        const box = this.canvas.getBoundingClientRect();
        const clamp = (value) => Math.max(-this.size / 2, Math.min(this.size / 2, value));

        return [clamp(((event.clientX - box.left) / box.width - 0.5) * this.size), clamp(((event.clientY - box.top) / box.height - 0.5) * this.size)];
    }

    drawMap()
    {
        const context = this.canvas.getContext("2d");
        const scale = MAP_PIXELS / this.size;

        context.clearRect(0, 0, MAP_PIXELS, MAP_PIXELS);

        if(this.image.complete && this.image.naturalWidth > 0) { context.drawImage(this.image, 0, 0, MAP_PIXELS, MAP_PIXELS); }

        context.lineWidth = 1.5;

        this.recipe?.features.forEach((feature, i) => this.drawFeature(context, feature, i === this.selected, scale));

        if(this.drawing) { this.drawDrawing(context); }

        this.drawCamera(context);
    }

    drawFeature(context, feature, isSelected, scale)
    {
        const shape = this.kinds.features[feature.kind].shape;

        context.strokeStyle = isSelected ? GOLD : PALE;
        context.fillStyle = isSelected ? GOLD : PALE;
        context.setLineDash(isSelected ? [] : [5, 3]);

        if(shape === "box")
        {
            const [left, top] = this.toPixels(feature.x - feature.width / 2, feature.z - feature.length / 2);

            context.beginPath();
            context.roundRect(left, top, feature.width * scale, feature.length * scale, Math.min(feature.width, feature.length) * 0.2 * scale);
            context.stroke();
        }

        if(shape === "line")
        {
            context.beginPath();
            feature.points.forEach(([x, z], k) => (k === 0 ? context.moveTo(...this.toPixels(x, z)) : context.lineTo(...this.toPixels(x, z))));
            context.stroke();

            for(const [x, z] of feature.points) { context.fillRect(this.toPixels(x, z)[0] - 2.5, this.toPixels(x, z)[1] - 2.5, 5, 5); }
        }

        if(shape === "point")
        {
            context.beginPath();
            context.arc(...this.toPixels(feature.x, feature.z), 4, 0, Math.PI * 2);
            context.fill();
        }

        context.setLineDash([]);
    }

    drawDrawing(context)
    {
        const { points, from, to } = this.drawing;

        context.strokeStyle = GOLD;
        context.fillStyle = GOLD;

        if(from && to)
        {
            const [x0, z0] = this.toPixels(...from);
            const [x1, z1] = this.toPixels(...to);

            context.strokeRect(Math.min(x0, x1), Math.min(z0, z1), Math.abs(x1 - x0), Math.abs(z1 - z0));
        }

        if(points.length > 0)
        {
            context.beginPath();
            points.forEach(([x, z], k) => (k === 0 ? context.moveTo(...this.toPixels(x, z)) : context.lineTo(...this.toPixels(x, z))));

            if(to) { context.lineTo(...this.toPixels(...to)); }

            context.stroke();
        }
    }

    drawCamera(context)
    {
        const { x, z } = this.editor.fly.position;
        const yaw = this.editor.fly.yaw;
        const [px, pz] = this.toPixels(x, z);
        const [fx, fz] = [-Math.sin(yaw), -Math.cos(yaw)];

        this.cameraMark = { x, z, yaw };
        context.fillStyle = "#7fc4ff";
        context.beginPath();
        context.moveTo(px + fx * 9, pz + fz * 9);
        context.lineTo(px - fx * 4 - fz * 5, pz - fz * 4 + fx * 5);
        context.lineTo(px - fx * 4 + fz * 5, pz - fz * 4 - fx * 5);
        context.fill();
    }

    /* POINTER ****************************************************************/

    onDown(event)
    {
        const at = this.toMetres(event);
        const shape = this.drawing ? this.kinds.features[this.drawing.kind].shape : null;

        this.canvas.setPointerCapture(event.pointerId);

        if(shape === "box") { this.drawing.from = at; }
        else if(shape === "line") { this.drawing.points.push(at.map(round)); }
        else if(shape === "point") { this.add({ kind: this.drawing.kind, ...defaultsOf(this.kinds.features[this.drawing.kind].settings), x: round(at[0]), z: round(at[1]) }); }
        else { this.grab(at); }

        this.drawMap();
    }

    onMove(event)
    {
        const at = this.toMetres(event);

        if(this.drawing)
        {
            this.drawing.to = at;
            this.drawMap();
            return;
        }

        if(!this.drag) { return; }

        const [dx, dz] = [at[0] - this.drag.at[0], at[1] - this.drag.at[1]];
        const feature = this.recipe.features[this.drag.index];

        if(this.drag.point !== null) { feature.points[this.drag.point] = [round(this.drag.start[0] + dx), round(this.drag.start[1] + dz)]; }
        else if(feature.points) { feature.points = this.drag.start.map(([x, z]) => [round(x + dx), round(z + dz)]); }
        else { [feature.x, feature.z] = [round(this.drag.start[0] + dx), round(this.drag.start[1] + dz)]; }

        this.drag.isMoved = true;
        this.drawMap();
    }

    onUp()
    {
        const box = this.drawing?.from && this.drawing?.to ? [this.drawing.from, this.drawing.to] : null;

        if(box && this.kinds.features[this.drawing.kind].shape === "box")
        {
            const [[x0, z0], [x1, z1]] = box;
            const [width, length] = [Math.abs(x1 - x0), Math.abs(z1 - z0)].map((value) => Math.round(value / 2) * 2);

            this.drawing.from = null;

            if(width >= MIN_BOX && length >= MIN_BOX) { this.add({ kind: this.drawing.kind, ...defaultsOf(this.kinds.features[this.drawing.kind].settings), x: round((x0 + x1) / 2), z: round((z0 + z1) / 2), width, length }); }

            return;
        }

        if(this.drag?.isMoved) { this.change(() => {}); }

        this.drag = null;
    }

    // A river's point wins over its line.
    grab(at)
    {
        const reach = HIT_PIXELS * this.size / MAP_PIXELS;
        const features = this.recipe.features;
        const near = (x, z) => Math.hypot(x - at[0], z - at[1]) <= reach;
        let found = null;

        for(let i = features.length - 1; i >= 0 && !found; i--)
        {
            const feature = features[i];
            const point = feature.points?.findIndex(([x, z]) => near(x, z)) ?? -1;

            if(point >= 0) { found = { index: i, point, start: [...feature.points[point]] }; }
            else if(feature.points && feature.points.some((p, k) => k > 0 && distanceToSegment(at, feature.points[k - 1], p) <= reach)) { found = { index: i, point: null, start: feature.points.map((p) => [...p]) }; }
            else if(feature.width !== undefined && Math.abs(at[0] - feature.x) <= feature.width / 2 && Math.abs(at[1] - feature.z) <= feature.length / 2) { found = { index: i, point: null, start: [feature.x, feature.z] }; }
            else if(feature.points === undefined && feature.width === undefined && near(feature.x, feature.z)) { found = { index: i, point: null, start: [feature.x, feature.z] }; }
        }

        this.drag = found ? { ...found, at, isMoved: false } : null;

        if((found?.index ?? -1) !== this.selected) { this.select(found?.index ?? -1); }
        if(!found) { this.flyTo(at); }
    }

    flyTo([x, z])
    {
        const zone = this.editor.zone;
        const fly = this.editor.fly;
        const floorAt = (px, pz) => Math.max(zone.heightAt(px, pz), zone.metresY(zone.waterCell));
        const above = Math.max(MIN_ABOVE, fly.position.y - floorAt(fly.position.x, fly.position.z));

        fly.setView({ ...fly.view, x, y: floorAt(x, z) + above, z });
    }
}


/******************************************************************************/
/* FIELDS                                                                     */
/******************************************************************************/

function numberField(setting, value, onChange, className = "")
{
    const input = Controls.element("input", "editor-number");

    input.type = "number";
    input.min = setting.min;
    input.max = setting.max;
    input.step = setting.step;
    input.value = value;
    input.dataset.key = setting.key;
    input.addEventListener("change", () =>
    {
        const number = Number(input.value);

        if(input.value !== "" && Number.isFinite(number)) { onChange(Math.max(setting.min, Math.min(setting.max, number))); }
    });

    const field = labelled(setting.label + (setting.unit ? " (" + setting.unit + ")" : ""), input, className);

    field.title = setting.detail ?? "";

    return field;
}

function choiceField(label, choices, value, onChange)
{
    const select = Controls.element("select", "editor-choice");

    for(const [choice, text] of choices)
    {
        const option = Controls.element("option", "", text);

        option.value = choice;
        select.append(option);
    }

    select.value = value;
    select.dataset.key = label.toLowerCase();
    select.addEventListener("change", () => onChange(select.value));

    return labelled(label, select);
}

function labelled(text, control, className = "")
{
    const field = Controls.element("label", ("editor-field " + className).trim());

    field.append(Controls.element("span", "", text), control);

    return field;
}

function defaultsOf(settings)
{
    return Object.fromEntries(settings.map((setting) => [setting.key, setting.value]));
}

function round(metres)
{
    return Math.round(metres);
}

function distanceToSegment([x, z], [ax, az], [bx, bz])
{
    const length = (bx - ax) ** 2 + (bz - az) ** 2;
    const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / length));

    return Math.hypot(x - ax - t * (bx - ax), z - az - t * (bz - az));
}
