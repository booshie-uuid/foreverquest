import * as Controls from "../ui/controls.js";
import { BrushStroke } from "./brush-stroke.js";
import { ZoneData } from "../sim/zone-data.js";

const CUBES = ZoneData.CUBES_PER_METRE;
const KINDS = [["ground", "Ground"], ["age", "Age"], ["sculpt", "Sculpt"]];
const SHAPES = [["circle", "Circle"], ["square", "Square"]];
const EDGES = [["ragged", "Ragged"], ["clean", "Clean"]];
const ACTIONS = [["raise", "Raise"], ["lower", "Lower"], ["smooth", "Smooth"], ["flatten", "Flatten"]];
const RADIUS = { key: "radius", label: "Radius", unit: "m", min: 1, max: 16, step: 1 };
const STRENGTH = { key: "strength", label: "Strength", unit: "%", min: 5, max: 100, step: 5 };
const AGE = { key: "age", label: "Age", unit: "", min: 0, max: 100, step: 5 };
const SPACING = 0.3;
const RING = 48;
const HINTS =
{
    ground: "Drag over the ground to paint it. Right-drag looks around; [ and ] or the wheel change the radius.",
    age: "Drag to weather the ground and all that stands on it towards the age. A placement with its own age keeps it.",
    sculpt: "Drag to shape the ground. Flatten levels towards the height where the stroke began. Ground under a placement stays.",
};


/******************************************************************************/
/* BRUSH TOOL                                                                 */
/******************************************************************************/

export class BrushTool
{
    constructor(editor)
    {
        this.editor = editor;
        this.brush = { kind: "ground", shape: "circle", edge: "ragged", radius: 4, strength: 50, ground: "grass", age: 60, action: "raise" };
        this.current = null;
        this.last = null;
        this.pending = new Map();
        this.cover = null;
        this.coverOf = null;
    }

    get name()
    {
        return "brush";
    }

    toolbar()
    {
        return [KINDS.map(([id, label]) => ({ label, isOn: this.brush.kind === id, action: "brush-" + id, onClick: () => this.set("kind", id) }))];
    }

    palette()
    {
        const content = [this.choices(SHAPES, "shape", "brush-"), numberField(RADIUS, this.brush.radius, (value) => this.set("radius", value))];

        if(this.brush.kind === "ground") { content.push(this.choices(EDGES, "edge", "brush-"), this.groundList()); }
        if(this.brush.kind === "sculpt") { content.push(this.choices(ACTIONS, "action", "sculpt-")); }
        if(this.brush.kind === "age") { content.push(numberField(AGE, this.brush.age, (value) => this.set("age", value))); }
        if(this.brush.kind !== "ground") { content.push(numberField(STRENGTH, this.brush.strength, (value) => this.set("strength", value))); }

        return { title: "Brush", content, hint: HINTS[this.brush.kind] };
    }

    groundList()
    {
        const list = Controls.element("div", "editor-swatches");

        for(const ground of BrushStroke.GROUNDS)
        {
            const entry = Controls.button("", () => this.set("ground", ground.id), "editor-swatch");

            entry.title = ground.label;
            entry.dataset.id = ground.id;
            entry.style.backgroundImage = "url(" + this.editor.swatch(this.editor.blocks.number(ground.top)) + ")";
            entry.classList.toggle("is-on", this.brush.ground === ground.id);
            list.append(entry);
        }

        return list;
    }

    // A row of buttons that sets the brush's `key` to one of `choices`.
    choices(choices, key, prefix)
    {
        const list = Controls.element("div", "editor-actions");

        for(const [id, label] of choices)
        {
            const button = Controls.button(label, () => this.set(key, id), "editor-button");

            button.dataset.action = prefix + id;
            button.classList.toggle("is-on", this.brush[key] === id);
            list.append(button);
        }

        return list;
    }

    set(key, value)
    {
        this.brush[key] = value;
        this.editor.redraw();
    }

    /* TOOL EVENTS ************************************************************/

    hover(hit)
    {
        this.editor.marks.hideGhost();

        if(hit) { this.editor.marks.showRing(this.ringAround(hit.cell), this.brush.kind); }
        else { this.editor.marks.hideRing(); }
    }

    click()
    {
    }

    wheel(factor)
    {
        this.set("radius", Math.max(RADIUS.min, Math.min(RADIUS.max, this.brush.radius + (factor > 1 ? -1 : 1))));
    }

    key(code)
    {
        if(code !== "BracketLeft" && code !== "BracketRight") { return false; }

        this.brush.radius = Math.max(RADIUS.min, Math.min(RADIUS.max, this.brush.radius + (code === "BracketRight" ? 1 : -1)));

        return true;
    }

    // Dabs fall SPACING of the radius apart along the stroke.
    stroke(phase, hit)
    {
        if(phase === "start" && hit)
        {
            this.current = new BrushStroke(this.editor.zone, this.editor.blocks, { ...this.brush, strength: this.brush.strength / 100 }, (column, row) => this.groundOf(column, row), this.coverMap());
            this.dab(hit.cell);
        }

        if(phase === "move" && hit && this.current && Math.hypot(hit.cell[0] - this.last[0], hit.cell[2] - this.last[2]) >= this.brush.radius * CUBES * SPACING) { this.dab(hit.cell); }
        if(phase === "end" && this.current) { this.finish(); }
    }

    dab(cell)
    {
        this.current.dab(cell);
        this.last = cell;
    }

    // Until the server's bake comes back, the zone's grounds miss the columns
    // the stroke moved, so the tool keeps them.
    async finish()
    {
        const stroke = this.current;

        this.current = null;

        if(this.brush.kind === "age")
        {
            const columns = stroke.ages();

            if(columns.length > 0) { await this.editor.send([{ type: "ages", columns }]); }

            return;
        }

        const { cells, old } = stroke.cells();

        for(const [index, state] of stroke.columns) { this.pending.set(index, state.applied); }

        if(cells.length > 0) { await this.editor.placeCubes(cells, old); }

        this.pending.clear();
    }

    /* GROUND *****************************************************************/

    groundOf(column, row)
    {
        const index = row * this.editor.zone.columns + column;

        return this.pending.get(index) ?? this.editor.zone.grounds[index];
    }

    coverMap()
    {
        const objects = this.editor.zone.objects;

        if(this.coverOf !== objects)
        {
            this.cover = BrushStroke.coverOf(objects, this.editor.zone.columns);
            this.coverOf = objects;
        }

        return this.cover;
    }

    ringAround([cx, , cz])
    {
        const zone = this.editor.zone;
        const radius = this.brush.radius * CUBES;

        return Array.from({ length: RING }, (unused, k) =>
        {
            const [u, v] = this.brush.shape === "square" ? squareAt(k / RING) : [Math.cos((k / RING) * Math.PI * 2), Math.sin((k / RING) * Math.PI * 2)];
            const column = Math.max(0, Math.min(zone.columns - 1, Math.round(cx + u * radius)));
            const row = Math.max(0, Math.min(zone.columns - 1, Math.round(cz + v * radius)));

            return [cx + 0.5 + u * radius, this.groundOf(column, row), cz + 0.5 + v * radius];
        });
    }
}

// A point a share `along` of the way round a square from -1 to 1 each way.
function squareAt(along)
{
    const side = Math.floor(along * 4);
    const part = along * 4 - side;

    return [[-1 + 2 * part, -1], [1, -1 + 2 * part], [1 - 2 * part, 1], [-1, 1 - 2 * part]][side];
}

function numberField({ key, label, unit, min, max, step }, value, onChange)
{
    const input = Controls.element("input", "editor-number");
    const field = Controls.element("label", "editor-field");

    input.type = "number";
    input.min = min;
    input.max = max;
    input.step = step;
    input.value = value;
    input.dataset.key = key;
    input.addEventListener("change", () =>
    {
        const number = Number(input.value);

        if(input.value !== "" && Number.isFinite(number)) { onChange(Math.max(min, Math.min(max, number))); }
    });
    field.append(Controls.element("span", "", label + (unit ? " (" + unit + ")" : "")), input);

    return field;
}
