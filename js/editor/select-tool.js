import * as Controls from "../ui/controls.js";
import * as Fields from "./fields.js";
import { ZoneData } from "../sim/zone-data.js";

const CUBES = ZoneData.CUBES_PER_METRE;
const TABS = [["prefabs", "Prefabs"], ["objects", "Objects"], ["buildings", "Buildings"]];
const PRECISION = 1e6;
const FINE = 8;
const AXES = [["x", "x"], ["y", "y"], ["z", "z"]];
const TRACKS = [["", "Stays put"], ["slide", "Slides"], ["turn", "Turns"], ["spin", "Spins"]];
const TRIGGERS = [["", "None"], ["lever", "Lever"], ["plate", "Plate"]];
const SECONDS = { key: "seconds", label: "Move time", unit: "s", min: 0.1, max: 60, step: 0.1 };
const NEAR = { key: "near", label: "When near, 0 off", unit: "m", min: 0, max: 50, step: 0.5 };
const EVERY = { key: "every", label: "Every, 0 off", unit: "s", min: 0, max: 600, step: 0.5 };
const SLIDE = ["x", "y", "z"].map((axis, i) => ({ key: "slide-" + axis, label: "Slide " + axis, unit: "cubes", min: -96, max: 96, step: 1, i }));
const PIVOT = ["x", "y", "z"].map((axis, i) => ({ key: "pivot-" + axis, label: "Pivot " + axis, unit: "fine", min: -64, max: 128, step: 1, i }));
const FROM = { key: "from", label: "From", unit: "°", min: -360, max: 360, step: 1 };
const DEGREES = { key: "degrees", label: "Turn by", unit: "°", min: -360, max: 360, step: 1 };
const SPIN = { key: "spin-seconds", label: "A turn takes", unit: "s", min: 0.5, max: 600, step: 0.5 };


/******************************************************************************/
/* SELECT TOOL                                                                */
/******************************************************************************/

// A selection is the prop number and, for a part, its part number, which stay
// the same when the zone bakes again.
export class SelectTool
{
    constructor(editor)
    {
        this.editor = editor;
        this.tab = "objects";
        this.search = "";
        this.adding = null;
        this.selected = null;
        this.target = null;
        this.capturing = null;
        this.isLinking = false;
    }

    get name()
    {
        return "select";
    }

    get entry()
    {
        const selected = this.selected;

        if(!selected) { return null; }

        return this.editor.zone.objects.find((entry) => entry.prop === selected.prop && entry.part === selected.part) ?? null;
    }

    toolbar()
    {
        const isSelected = this.entry !== null;

        return [[
            { label: "Capture", isOn: this.capturing !== null, action: "capture", onClick: () => this.startCapture() },
            { label: "Move", key: "←↑→↓ PgUp PgDn", isDisabled: !isSelected, action: "move", onClick: () => this.move([1, 0, 0]) },
            { label: "Turn", key: "R", isDisabled: !isSelected, action: "turn", onClick: () => this.turn(1) },
            { label: "Copy", key: "Ctrl+D", isDisabled: !isSelected || this.entry.part !== undefined, action: "copy", onClick: () => this.copy() },
            { label: "Delete", key: "Del", isDisabled: !isSelected, action: "delete", onClick: () => this.remove() },
        ]];
    }

    /* PALETTE ****************************************************************/

    palette()
    {
        const tabs = TABS.map(([id, label]) => ({ label, isOn: this.tab === id, onClick: () => this.setTab(id) }));
        const items = this.ids().filter((id) => id.toLowerCase().includes(this.search.toLowerCase())).map((id) => ({ id, label: id, swatch: null, isOn: this.adding?.id === id }));
        const hint = this.adding ? "Click in the world to add " + this.adding.id + " at the pointer. Click it again in the list, or press Escape, to select instead." : "Click a placement to select it, or a name here to add one.";

        return { title: TABS.find(([id]) => id === this.tab)[1], tabs, items, onPick: (id) => this.choose(id), hint, search: { value: this.search, onInput: (text) => this.setSearch(text) } };
    }

    ids()
    {
        const { prefabs, objects } = this.editor.content;

        if(this.tab === "objects") { return Object.keys(objects).sort(); }

        const isBuilding = (id) => (prefabs[id].doors ?? []).length > 0;

        return Object.keys(prefabs).filter((id) => isBuilding(id) === (this.tab === "buildings")).sort();
    }

    setTab(tab)
    {
        this.tab = tab;
        this.adding = null;
        this.editor.redraw();
    }

    setSearch(text)
    {
        this.search = text;
        this.editor.redraw();
    }

    choose(id)
    {
        this.adding = this.adding?.id === id ? null : { id, kind: this.tab === "objects" ? "object" : "prefab" };
        this.editor.redraw();
    }

    wheel()
    {
    }

    /* POINTER ****************************************************************/

    hover(hit)
    {
        this.target = null;

        if(this.capturing)
        {
            this.hoverCapture(hit);
            return;
        }

        if(!this.adding || !hit)
        {
            this.editor.marks.hideGhost();
            return;
        }

        const cell = hit.normal ? hit.cell.map((value, axis) => value + hit.normal[axis]) : hit.cell;
        const reach = this.adding.kind === "object" ? [0, 0, 0, ...this.editor.content.objects[this.adding.id].cells.map((count) => count - 1)] : prefabReach(this.editor.content.prefabs[this.adding.id]);

        this.target = cell;
        this.editor.marks.showGhost(reach.map((offset, i) => cell[i % 3] + offset), "add");
    }

    async click(hit, objectHit)
    {
        if(this.capturing)
        {
            this.clickCapture(hit);
            return;
        }

        if(this.adding)
        {
            if(this.target) { await this.add(this.target); }
            return;
        }

        const entry = await this.entryAt(hit, objectHit);

        if(this.isLinking)
        {
            await this.linkTo(entry);
            return;
        }

        if(!entry && hit) { this.editor.panel.say("That is the zone's own terrain; use Cubes to change it."); }

        this.select(entry);
    }

    // The bake leaves a mover's cells out of the regions, so the server names
    // no owner for them.
    async entryAt(hit, objectHit)
    {
        const isObjectNearer = objectHit && (!hit || objectHit.distance <= hit.distance + 0.05);

        if(isObjectNearer) { return objectHit.entry; }
        if(!hit) { return null; }

        const at = hit.cell.join();
        const mover = this.editor.zone.objects.find((entry) => entry.mover && entry.cells.some((cell) => cell.join() === at));

        if(mover) { return mover; }

        const { object } = await this.editor.client.owner(hit.cell);

        return object === null ? null : this.editor.zone.objects[object] ?? null;
    }

    select(entry)
    {
        this.selected = entry ? { prop: entry.prop, part: entry.part } : null;
        this.isLinking = false;
        this.editor.redraw();
    }

    // Selects the last prop, which an add or a copy has just appended.
    selectNewest()
    {
        const newest = Math.max(...this.editor.zone.objects.map((entry) => entry.prop));

        this.select(this.editor.zone.objects.find((entry) => entry.prop === newest && entry.part === undefined) ?? null);
    }

    async add(cell)
    {
        const zone = this.editor.zone;
        const round = (value) => Math.round(value * PRECISION) / PRECISION;
        let placement;

        if(this.adding.kind === "object")
        {
            const [width, , depth] = this.editor.content.objects[this.adding.id].cells;

            placement = { object: this.adding.id, x: round((cell[0] + width / 2) / CUBES - zone.half), z: round((cell[2] + depth / 2) / CUBES - zone.half), y: round(zone.metresY(cell[1])), angle: 0 };
        }
        else
        {
            placement = { prefab: this.adding.id, x: round(cell[0] / CUBES - zone.half), z: round(cell[2] / CUBES - zone.half), angle: 0 };
        }

        if(await this.editor.send([{ type: "add", placement }])) { this.selectNewest(); }
    }

    /* CHANGES ****************************************************************/

    key(code, event)
    {
        const [ax, az] = this.editor.fly.facingAxis();
        const moves =
        {
            ArrowUp: [ax, 0, az],
            ArrowDown: [-ax, 0, -az],
            ArrowRight: [-az, 0, ax],
            ArrowLeft: [az, 0, -ax],
            PageUp: [0, 1, 0],
            PageDown: [0, -1, 0],
        };

        if(this.capturing) { return this.keyCapture(code, event); }

        if(code === "Escape" && this.isLinking)
        {
            this.setLinking(false);
            return true;
        }

        if(code === "Escape" && (this.adding || this.selected))
        {
            this.adding = null;
            this.select(null);
            return true;
        }

        if(!this.entry) { return false; }

        if(code === "ArrowUp" && event?.ctrlKey) { this.selectBuilding(); }
        else if(moves[code]) { this.move(moves[code]); }
        else if(code === "KeyR") { this.turn(event?.shiftKey ? -1 : 1); }
        else if(code === "Delete") { this.remove(); }
        else if(code === "KeyD" && event?.ctrlKey) { this.copy(); }
        else if(code === "KeyB" && this.entry.object) { this.editor.openBench(this.entry.object); }
        else { return false; }

        return true;
    }

    move(by)
    {
        const { prop, part } = this.selected;

        this.editor.queueMove({ prop, part, by, turns: 0 });
    }

    turn(turns)
    {
        const { prop, part } = this.selected;

        this.editor.queueMove({ prop, part, by: [0, 0, 0], turns });
    }

    async remove()
    {
        const { prop, part } = this.selected;

        this.select(null);
        await this.editor.send([{ type: "delete", prop, part }]);
    }

    async copy()
    {
        if(this.entry.part !== undefined) { return; }

        if(await this.editor.send([{ type: "copy", prop: this.selected.prop, by: [CUBES, 0, 0] }])) { this.selectNewest(); }
    }

    selectBuilding()
    {
        this.select(this.editor.zone.objects.find((entry) => entry.prop === this.selected.prop && entry.part === undefined) ?? null);
    }

    /* INSPECTOR **************************************************************/

    inspector()
    {
        const entry = this.entry;

        if(!entry) { return null; }

        const zone = this.editor.zone;
        const building = zone.objects.find((other) => other.prop === entry.prop && other.part === undefined);
        const isPart = entry.part !== undefined;
        const isPrefab = !entry.object && !entry.name.startsWith("run ");
        const kind = (isPart ? building : entry).name;
        const hasOverrides = zone.objects.some((other) => other.prop === entry.prop && other.isOverride);
        const [x0, y0, z0, x1, y1, z1] = entry.box;
        const cubes = [x1 - x0 + 1, y1 - y0 + 1, z1 - z0 + 1];
        const rows =
        [
            ["Corner cell", x0 + ", " + y0 + ", " + z0, entry.isOverride],
            ["Turn", entry.turns * 90 + "°", false],
            ["Size", cubes.join(" × ") + " cubes (" + cubes.map((count) => (count / CUBES).toFixed(1)).join(" × ") + " m)", false],
        ];
        const actions = isPart || (isPrefab && hasOverrides) ?
        [
            { label: "Apply to all " + kind + "s", isDisabled: !hasOverrides, action: "apply-to-all", onClick: () => this.editor.send([{ type: "applyToAll", prop: entry.prop }]) },
            { label: "Reset to the " + kind + "'s layout", isDisabled: !hasOverrides, action: "reset-parts", onClick: () => this.editor.send([{ type: "resetParts", prop: entry.prop }]) },
        ] : [];
        const more = [];

        if(entry.object && !isPart) { more.push(...this.motionActions(entry)); }
        if(isPart) { more.push({ label: "Select the " + kind, key: "Ctrl+↑", action: "select-building", onClick: () => this.selectBuilding() }); }
        if(isPrefab && !isPart) { more.push({ label: "Break apart into cubes", isWarning: true, action: "break-apart", onClick: () => this.breakApart() }); }
        if(entry.object) { more.push({ label: "Open in the bench", key: "B", action: "open-bench", onClick: () => this.editor.openBench(entry.object) }); }

        more.push({ label: "Delete", key: "Del", action: "delete-selected", onClick: () => this.remove() });

        if(isPart && entry.mover) { rows.push(["Moves", trackOf(entry.mover), false]); }
        if(isPart && entry.trigger) { rows.push([entry.trigger.lever ? "Lever for" : "Plate for", entry.trigger.movers.join(", ") || "nothing", false]); }

        return {
            title: entry.object ?? entry.name,
            detail: isPart ? "Part of the " + kind + " (prop " + entry.prop + ") at " + building.x.toFixed(1) + ", " + building.z.toFixed(1) : "Prop " + entry.prop + (entry.id ? ", id " + entry.id : ""),
            rows,
            note: entry.isOverride ? "● Changed in this " + kind + " only" : "",
            content: entry.object && !isPart ? this.motionForm(entry) : [],
            actions,
            more,
        };
    }

    /* MOTION *****************************************************************/

    // The movers the selected trigger works, or the triggers that work the
    // selected mover.
    linked()
    {
        const entry = this.entry;
        const objects = this.editor.zone.objects;

        if(!entry) { return []; }

        const movers = entry.trigger ? objects.filter((other) => other.mover && entry.trigger.movers.includes(other.id)) : [];
        const triggers = entry.mover && entry.id ? objects.filter((other) => other.trigger?.movers.includes(entry.id)) : [];

        return [...movers, ...triggers];
    }

    motionActions(entry)
    {
        const actions = [];
        const movers = entry.trigger ? this.linked().filter((other) => other.mover) : [];

        if(entry.trigger) { actions.push({ label: this.isLinking ? "Stop linking" : "Link movers", key: this.isLinking ? "Esc" : "", isOn: this.isLinking, action: "link-movers", onClick: () => this.setLinking(!this.isLinking) }); }
        if(entry.mover || movers.length > 0) { actions.push({ label: "Play", action: "play-movers", onClick: () => this.editor.play(entry.mover ? [entry] : movers) }); }

        return actions;
    }

    setLinking(isLinking)
    {
        this.isLinking = isLinking;
        this.editor.redraw();

        if(isLinking) { this.editor.panel.say("Click a mover to link it, or a linked one to unlink it. Escape stops."); }
    }

    async linkTo(entry)
    {
        if(!entry?.mover || entry.part !== undefined)
        {
            this.editor.panel.say("That is not a mover the zone places itself; make an object a mover in its inspector first.");
            return;
        }

        await this.editor.send([{ type: "link", prop: this.selected.prop, mover: entry.prop }]);
    }

    motionForm(entry)
    {
        const mover = entry.mover;
        const track = TRACKS.find(([kind]) => kind && mover?.[kind])?.[0] ?? "";
        const trigger = entry.trigger ? (entry.trigger.lever ? "lever" : "plate") : "";
        const form = Controls.element("div", "editor-form");
        const setMover = (change) => this.sendMotion({ mover: { ...mover, ...change } });

        form.append(Controls.element("h4", "", "Moves"), Fields.choiceField("track", "Track", TRACKS, track, (kind) => this.sendMotion({ mover: kind ? this.newMover(entry, kind) : null })));

        if(mover?.slide) { form.append(...SLIDE.map((setting) => Fields.numberField(setting, mover.slide[setting.i], (value) => setMover({ slide: mover.slide.with(setting.i, Math.round(value)) })))); }

        if(mover?.turn)
        {
            const setTurn = (change) => setMover({ turn: { ...mover.turn, ...change } });

            form.append(Fields.choiceField("axis", "Axis", AXES, mover.turn.axis, (axis) => setTurn({ axis })));
            form.append(...PIVOT.map((setting) => Fields.numberField(setting, mover.turn.pivot[setting.i], (value) => setTurn({ pivot: mover.turn.pivot.with(setting.i, value) }))));
            form.append(Fields.numberField(FROM, mover.turn.from ?? 0, (from) => setTurn({ from })), Fields.numberField(DEGREES, mover.turn.degrees, (degrees) => setTurn({ degrees })));
        }

        if(mover?.spin)
        {
            form.append(Fields.choiceField("axis", "Axis", AXES, mover.spin.axis, (axis) => setMover({ spin: { ...mover.spin, axis } })));
            form.append(Fields.numberField(SPIN, mover.spin.seconds, (seconds) => setMover({ spin: { ...mover.spin, seconds } })));
        }

        if(mover && !mover.spin)
        {
            const optional = (key) => (value) => setMover({ [key]: value > 0 ? value : undefined });

            form.append(Fields.numberField(SECONDS, mover.seconds, (seconds) => setMover({ seconds })));
            form.append(Fields.numberField(NEAR, mover.near ?? 0, optional("near")), Fields.numberField(EVERY, mover.every ?? 0, optional("every")));
        }

        form.append(Controls.element("h4", "", "Works movers"), Fields.choiceField("trigger", "Trigger", TRIGGERS, trigger, (kind) => this.sendMotion({ trigger: kind || null })));

        if(entry.trigger) { form.append(Controls.element("div", "editor-hint", entry.trigger.movers.length > 0 ? "Works " + entry.trigger.movers.join(", ") + "." : "Works no mover yet.")); }

        return [form];
    }

    newMover(entry, kind)
    {
        const [width, height, depth] = this.editor.content.objects[entry.object].cells;

        if(kind === "slide") { return { slide: [0, height, 0], seconds: 2 }; }
        if(kind === "turn") { return { turn: { axis: "x", pivot: [width * FINE / 2, 0, depth * FINE / 2], from: 0, degrees: 90 }, seconds: 1 }; }

        return { spin: { axis: "x", seconds: 10 } };
    }

    sendMotion(change)
    {
        this.editor.send([{ type: "motion", prop: this.selected.prop, ...change }]);
    }

    /* CAPTURE ****************************************************************/

    startCapture()
    {
        this.capturing = this.capturing ? null : { start: null, box: null, isRaising: false, name: "", isReplacing: true };
        this.adding = null;
        this.select(null);
        this.editor.panel.setCard(null);

        if(this.capturing) { this.editor.panel.say("Click one corner of the box's footprint, then the opposite corner."); }
        else { this.editor.marks.hideGhost(); }
    }

    // The footprint lies flat at the first corner's height until it is
    // clicked; the box's top then follows the pointer until the next click.
    hoverCapture(hit)
    {
        const { start, box, isRaising } = this.capturing;

        if(box && isRaising) { box[4] = Math.max(box[1], Math.min(this.editor.zone.height - 1, this.topAtPointer() ?? box[4])); }

        if(box) { this.editor.marks.showGhost(box, "select"); }
        else if(start && hit) { this.editor.marks.showGhost(footprintOf(start, groundCornerOf(hit)), "select"); }
        else if(hit) { this.editor.marks.showGhost([...groundCornerOf(hit), ...groundCornerOf(hit)], "select"); }
        else { this.editor.marks.hideGhost(); }
    }

    clickCapture(hit)
    {
        const capturing = this.capturing;

        if(capturing.isRaising)
        {
            capturing.isRaising = false;
            this.showCaptureCard();
            return;
        }

        if(!hit || capturing.box) { return; }

        if(!capturing.start)
        {
            capturing.start = groundCornerOf(hit);
            return;
        }

        capturing.box = footprintOf(capturing.start, groundCornerOf(hit));
        capturing.box[4] = Math.max(capturing.box[1], this.highestIn(capturing.box));
        capturing.isRaising = true;
        this.editor.panel.say("Move the pointer up or down to set the top of the box, then click.");
    }

    highestIn([x0, , z0, x1, , z1])
    {
        const zone = this.editor.zone;
        let highest = 0;

        for(let z = z0; z <= z1; z++)
        {
            for(let x = x0; x <= x1; x++) { highest = Math.max(highest, zone.surfaces[z * zone.columns + x] - 1); }
        }

        return highest;
    }

    // The cell height where the pointer's ray meets the upright plane through
    // the box's middle that faces the camera, or null where it does not.
    topAtPointer()
    {
        const pointer = this.editor.pointer;

        if(!pointer) { return null; }

        const zone = this.editor.zone;
        const { origin, direction } = this.editor.ray(pointer.x, pointer.y);
        const [x0, , z0, x1, , z1] = this.capturing.box;
        const [mx, mz] = [(x0 + x1 + 1) / 2 / CUBES - zone.half, (z0 + z1 + 1) / 2 / CUBES - zone.half];
        const [nx, nz] = [direction.x, direction.z];
        const facing = direction.x * nx + direction.z * nz;
        const distance = ((mx - origin.x) * nx + (mz - origin.z) * nz) / facing;

        return facing > 0 && distance > 0 ? Math.floor(zone.cellY(origin.y + direction.y * distance)) : null;
    }

    // Page Up and Page Down move the box's top, and with Shift its bottom.
    keyCapture(code, event)
    {
        const box = this.capturing.box;

        if(code === "Escape")
        {
            this.startCapture();
            return true;
        }

        if(!box || this.capturing.isRaising || (code !== "PageUp" && code !== "PageDown")) { return false; }

        const step = code === "PageUp" ? 1 : -1;
        const face = event?.shiftKey ? 1 : 4;

        box[face] = Math.max(face === 1 ? 0 : box[1], Math.min(face === 1 ? box[4] : this.editor.zone.height - 1, box[face] + step));
        this.showCaptureCard();

        return true;
    }

    showCaptureCard()
    {
        const capturing = this.capturing;
        const [x0, y0, z0, x1, y1, z1] = capturing.box;
        const name = Controls.element("input", "editor-search");
        const replace = Controls.element("input", "");
        const replaceField = Controls.element("label", "editor-field");
        const nameField = Controls.element("label", "editor-field");
        const save = (as) => this.editor.capture({ box: capturing.box, id: capturing.name.trim(), as, replace: capturing.isReplacing });

        name.placeholder = "ruinedArch";
        name.value = capturing.name;
        name.dataset.key = "name";
        name.addEventListener("input", () => { capturing.name = name.value; });
        replace.type = "checkbox";
        replace.checked = capturing.isReplacing;
        replace.dataset.key = "replace";
        replace.addEventListener("change", () => { capturing.isReplacing = replace.checked; });
        nameField.append(Controls.element("span", "", "Name"), name);
        replaceField.append(replace, Controls.element("span", "", "Put the new piece in the cubes' place"));
        this.editor.marks.showGhost(capturing.box, "select");
        this.editor.panel.setCard(
        {
            title: "Capture " + [x1 - x0 + 1, y1 - y0 + 1, z1 - z0 + 1].join(" × ") + " cubes",
            content: [nameField, replaceField, Controls.element("div", "editor-hint", "Page Up and Page Down move the top of the box a cube; with Shift, its bottom. The box shrinks to the cubes it holds. A prefab stays at cube scale; an object, at most 8 cubes a side, turns each cube into 8 × 8 × 8 fine cubes.")],
            actions:
            [
                { label: "Save as prefab", isOn: true, action: "capture-prefab", onClick: () => save("prefab") },
                { label: "Save as object", action: "capture-object", onClick: () => save("object") },
                { label: "Cancel", action: "capture-cancel", onClick: () => this.startCapture() },
            ],
        });
    }

    async breakApart()
    {
        const prop = this.selected.prop;

        this.select(null);
        await this.editor.send([{ type: "breakApart", prop }]);
    }
}

// The flat box over the cells between two cells, at the lower one's height,
// as [x0, y0, z0, x1, y1, z1].
function footprintOf(from, to)
{
    const y = Math.min(from[1], to[1]);

    return [Math.min(from[0], to[0]), y, Math.min(from[2], to[2]), Math.max(from[0], to[0]), y, Math.max(from[2], to[2])];
}

// A click on the top of a cube marks the cell above it, so a capture box
// stands on the ground rather than taking it in.
function groundCornerOf({ cell, normal })
{
    return normal?.[1] === 1 ? [cell[0], cell[1] + 1, cell[2]] : cell;
}

// The cells a prefab's blocks reach from the cell at its origin, as
// [x0, y0, z0, x1, y1, z1], before any turn.
function prefabReach(prefab)
{
    const low = [Infinity, Infinity, Infinity];
    const high = [-Infinity, -Infinity, -Infinity];

    for(const { at, size } of prefab.blocks)
    {
        for(let axis = 0; axis < 3; axis++)
        {
            low[axis] = Math.min(low[axis], Math.round((at[axis] - size[axis] / 2) * CUBES));
            high[axis] = Math.max(high[axis], Math.round((at[axis] + size[axis] / 2) * CUBES) - 1);
        }
    }

    return low[0] === Infinity ? [0, 0, 0, 0, 0, 0] : [...low, ...high];
}

// A mover's track in words.
function trackOf(mover)
{
    if(mover.slide) { return "slides " + mover.slide.join(", ") + " cubes"; }
    if(mover.turn) { return "turns " + mover.turn.degrees + "° about " + mover.turn.axis; }

    return "spins about " + mover.spin.axis;
}
