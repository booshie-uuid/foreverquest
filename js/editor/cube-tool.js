import { PaletteFilter } from "./palette-filter.js";

const ACTIONS = [["add", "Add"], ["remove", "Remove"], ["replace", "Replace"]];
const SIZES = [[1, "1"], [3, "3×3"], [5, "5×5"], ["box", "Box"]];
const RECENT = 10;
const RECENT_TYPE = "recent";
const MAX_BOX = 40000;


/******************************************************************************/
/* CUBE TOOL                                                                  */
/******************************************************************************/

export class CubeTool
{
    constructor(editor)
    {
        this.editor = editor;
        this.action = "add";
        this.size = 1;
        this.block = editor.blockNumbers.find((number) => editor.blocks.block(number).id === "cobble") ?? editor.blockNumbers[0];
        this.filter = new PaletteFilter({ types: editor.content.catalogue.blockTypes, packs: editor.content.catalogue.packs, entries: editor.content.catalogue.blocks, extras: [[RECENT_TYPE, "Recent"]] });
        this.recent = [];
        this.search = "";
        this.revealing = null;
        this.boxStart = null;
        this.target = null;
    }

    get name()
    {
        return "cubes";
    }

    toolbar()
    {
        const actions = ACTIONS.map(([id, label]) => ({ label, isOn: this.action === id, action: "cube-" + id, onClick: () => this.setAction(id) }));
        const sizes = SIZES.map(([id, label]) => ({ label, isOn: this.size === id, action: "size-" + id, onClick: () => this.setSize(id) }));

        return { tools: actions, options: [{ label: "Size", items: sizes }] };
    }

    setAction(action)
    {
        this.action = action;
        this.editor.redraw();
    }

    cycle()
    {
        const index = ACTIONS.findIndex(([id]) => id === this.action);

        this.setAction(ACTIONS[(index + 1) % ACTIONS.length][0]);
    }

    setSize(size)
    {
        this.size = size;
        this.boxStart = null;
        this.editor.redraw();
    }

    palette()
    {
        const blocks = this.editor.blocks;
        const idOf = (number) => blocks.block(number).id;
        const listed = this.filter.type === RECENT_TYPE ? this.recent : this.editor.blockNumbers;
        const search = this.search.toLowerCase();
        const shown = listed.filter((number) => this.filter.matches(idOf(number)) && idOf(number).toLowerCase().includes(search));
        const chosen = blocks.block(this.block);
        const reveal = this.revealing;

        this.revealing = null;

        return {
            title: "Blocks",
            search: { value: this.search, onInput: (text) => this.setSearch(text) },
            filters: [this.filter.fields(this.editor.blockNumbers.map(idOf), () => this.editor.redraw())],
            reveal,
            items: shown.map((number) => ({ id: number, label: blocks.block(number).id, swatch: this.editor.swatch(number), isOn: number === this.block })),
            onPick: (number) => this.choose(number),
            hint: "The wheel steps through the blocks shown; middle-click a cube to pick its block.",
            footer: "Selected: " + chosen.id + " · " + chosen.kind + (chosen.light ? " · light " + chosen.light : ""),
        };
    }

    setSearch(text)
    {
        this.search = text;
        this.editor.redraw();
    }

    choose(number)
    {
        this.block = number;
        this.recent = [number, ...this.recent.filter((entry) => entry !== number)].slice(0, RECENT);
        this.revealing = number;
        this.editor.redraw();
    }

    wheel(factor)
    {
        const shown = this.palette().items.map((item) => item.id);
        const at = shown.indexOf(this.block);

        if(shown.length === 0) { return; }

        this.choose(shown[(at + (factor > 1 ? 1 : -1) + shown.length) % shown.length]);
    }

    /* TARGET *****************************************************************/

    hover(hit)
    {
        this.target = null;

        if(!hit)
        {
            this.editor.marks.hideGhost();
            return;
        }

        const isAdding = this.action === "add" && hit.normal;
        const cell = isAdding ? hit.cell.map((value, axis) => value + hit.normal[axis]) : hit.cell;
        const box = this.boxOf(cell, hit.normal ?? [0, 1, 0]);

        this.target = { cell, box };
        this.editor.marks.showGhost(box, this.action);
    }

    boxOf(cell, normal)
    {
        if(this.size === "box")
        {
            const start = this.boxStart ?? cell;

            return [0, 1, 2].map((axis) => Math.min(start[axis], cell[axis])).concat([0, 1, 2].map((axis) => Math.max(start[axis], cell[axis])));
        }

        const reach = (this.size - 1) / 2;
        const spread = normal.map((value) => (value === 0 ? reach : 0));

        return [0, 1, 2].map((axis) => cell[axis] - spread[axis]).concat([0, 1, 2].map((axis) => cell[axis] + spread[axis]));
    }

    click()
    {
        if(!this.target) { return; }

        if(this.size === "box" && !this.boxStart)
        {
            this.boxStart = this.target.cell;
            this.editor.panel.say("Box started. Click the opposite corner to fill it, or Escape to cancel.");
            return;
        }

        const [x0, y0, z0, x1, y1, z1] = this.target.box;
        const count = (x1 - x0 + 1) * (y1 - y0 + 1) * (z1 - z0 + 1);

        this.boxStart = null;

        if(count > MAX_BOX)
        {
            this.editor.panel.say("That box holds " + count + " cubes; the most at once is " + MAX_BOX + ".");
            return;
        }

        const block = this.action === "remove" ? 0 : this.block;
        const cells = [];

        for(let y = y0; y <= y1; y++)
        {
            for(let z = z0; z <= z1; z++)
            {
                for(let x = x0; x <= x1; x++)
                {
                    const old = this.editor.zone.blockAt(x, y, z);
                    const isOpen = old === 0 || this.editor.blocks.isLiquid(old);
                    const isChanged = this.action === "add" ? isOpen && old !== block : old !== 0 && old !== block;

                    if(isChanged) { cells.push([x, y, z, block]); }
                }
            }
        }

        if(cells.length > 0) { this.editor.placeCubes(cells); }
    }

    // The middle button picks the block under the pointer.
    pick(hit)
    {
        const block = hit ? this.editor.zone.blockAt(...hit.cell) : 0;

        if(block === 0 || !this.editor.blockNumbers.includes(block)) { return; }

        const id = this.editor.blocks.block(block).id;

        this.filter.reveal(id);

        if(!id.toLowerCase().includes(this.search.toLowerCase())) { this.search = ""; }

        this.choose(block);
    }

    key(code)
    {
        if(code !== "Escape" || !this.boxStart) { return false; }

        this.boxStart = null;
        this.editor.panel.say("Box cancelled.");

        return true;
    }
}
