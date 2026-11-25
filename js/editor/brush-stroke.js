import * as Noise from "../util/noise.js";
import { ZoneData } from "../sim/zone-data.js";

const CUBES = ZoneData.CUBES_PER_METRE;
const UNDER_DEPTH = 3;
const SOFT = ["earth", "sand"];

// A ground stroke's edge wanders WOBBLE of the radius in and out over SCALE
// cells, and a share STRAY of the columns up to STRAYS of the radius past
// it are painted too.
const EDGE = { wobble: 0.4, scale: 6, strays: 0.25, stray: 0.12, seed: 191, straySeed: 197 };

// A dab at full strength raises or lowers the middle STEP cubes; smoothing
// averages the columns up to REACH cells around.
const SCULPT = { step: 1.5, reach: 2 };



/******************************************************************************/
/* BRUSH STROKE                                                               */
/******************************************************************************/

// Each dab changes the zone's cells in place; `cells()` and `ages()` give
// what the whole stroke changed.
export class BrushStroke
{
    static GROUNDS =
    [
        { id: "grass", label: "Grass", top: "grass", under: "earth" },
        { id: "moss", label: "Moss", top: "moss", under: "earth" },
        { id: "mud", label: "Mud", top: "mud", under: "earth" },
        { id: "sand", label: "Sand", top: "sand", under: "sand" },
        { id: "earth", label: "Earth", top: "earth", under: "earth" },
        { id: "cobble", label: "Cobble", top: "cobble", under: "earth" },
        { id: "rock", label: "Rock", top: "rock", under: "rock" },
    ];

    // `brush` holds the kind ("ground", "age" or "sculpt"), the shape
    // ("circle" or "square", whose radius is half its side), the radius in
    // metres and the strength from 0 to 1, with the ground's id and its edge
    // ("ragged" or "clean"), the age, or
    // the sculpt action ("raise", "lower", "smooth" or "flatten").
    // `groundOf(column, row)` gives a column's terrain surface, and `cover`
    // the lowest cell of any placement over each column, by column index.
    constructor(zone, blocks, brush, groundOf, cover)
    {
        this.zone = zone;
        this.blocks = blocks;
        this.brush = brush;
        this.groundOf = groundOf;
        this.cover = cover;
        this.radius = brush.radius * CUBES;
        this.originals = new Map();
        this.latest = new Map();
        this.columns = new Map();
        this.painted = new Map();
        this.level = null;
        this.water = blocks.number("water");
        this.soft = SOFT.map((id) => blocks.number(id));
    }

    // The lowest cell of any placement over each column, by column index,
    // from the zone index's `objects`. A run such as a wall follows the ground
    // and its box can span a village, so runs cover nothing; the server still
    // refuses their cells.
    static coverOf(objects, columns)
    {
        const cover = new Map();

        for(const { box } of objects.filter((entry) => entry.box && !entry.name.startsWith("run ")))
        {
            for(let row = box[2]; row <= box[5]; row++)
            {
                for(let column = box[0]; column <= box[3]; column++)
                {
                    const index = row * columns + column;

                    cover.set(index, Math.min(cover.get(index) ?? Infinity, box[1]));
                }
            }
        }

        return cover;
    }

    // Only the column of `cell` counts. Returns the cells the dab changed.
    dab([cx, , cz])
    {
        const changed = [];

        if(this.brush.kind === "ground") { this.paintGround(cx, cz, changed); }
        if(this.brush.kind === "age") { this.paintAge(cx, cz); }
        if(this.brush.kind === "sculpt") { this.sculpt(cx, cz, changed); }

        this.zone.setCells(changed);

        return changed;
    }

    // Every cell whose block the stroke changed, as [x, y, z, block], and
    // each one's block before the stroke.
    cells()
    {
        const cells = [...this.latest].filter(([key, cell]) => cell[3] !== this.originals.get(key)).map(([, cell]) => cell);
        const old = cells.map(([x, y, z]) => [x, y, z, this.originals.get(x + "," + y + "," + z)]);

        return { cells, old };
    }

    // Each column whose age the stroke changed, as [column, row, age].
    ages()
    {
        return [...this.painted].map(([index, age]) => [index % this.zone.columns, Math.floor(index / this.zone.columns), Math.round(age)]).filter(([column, row, age]) => age !== this.zone.age(column, row));
    }

    /* KINDS ******************************************************************/

    paintGround(cx, cz, changed)
    {
        const ground = BrushStroke.GROUNDS.find((entry) => entry.id === this.brush.ground);
        const [top, under] = [this.blocks.number(ground.top), this.blocks.number(ground.under)];

        this.each(cx, cz, 1 + EDGE.strays, (column, row, distance) =>
        {
            const isRagged = this.brush.edge !== "clean";
            const edge = isRagged ? this.radius * (1 - EDGE.wobble / 2 + EDGE.wobble * Noise.value(column / EDGE.scale, row / EDGE.scale, EDGE.seed)) : this.radius;
            const isStray = isRagged && distance < edge + this.radius * EDGE.strays && Noise.value(column, row, EDGE.straySeed) < EDGE.stray;
            const surface = this.groundOf(column, row);

            if((distance > edge && !isStray) || surface < 1 || this.isCovered(column, row, surface - 1)) { return; }

            this.set(column, surface - 1, row, top, changed);

            for(let y = surface - 2; y >= Math.max(0, surface - 1 - UNDER_DEPTH); y--)
            {
                if(this.soft.includes(this.zone.blockAt(column, y, row))) { this.set(column, y, row, under, changed); }
            }
        });
    }

    paintAge(cx, cz)
    {
        this.each(cx, cz, 1, (column, row, distance) =>
        {
            const index = row * this.zone.columns + column;
            const age = this.painted.get(index) ?? this.zone.age(column, row);

            this.painted.set(index, age + (this.brush.age - age) * this.brush.strength * falloff(distance / this.radius));
        });
    }

    // Each column's new height comes from the heights before the dab, so a
    // smoothing dab reads no column it has already moved.
    sculpt(cx, cz, changed)
    {
        const moves = [];

        this.level ??= this.heightOf(cx, cz);

        this.each(cx, cz, 1, (column, row, distance) =>
        {
            const weight = falloff(distance / this.radius) * this.brush.strength;
            const height = this.heightOf(column, row);

            if(weight <= 0 || this.isCovered(column, row, Infinity)) { return; }

            moves.push([column, row, height + this.change(column, row, height) * weight]);
        });

        for(const [column, row, height] of moves) { this.shape(column, row, Math.max(1, Math.min(this.zone.height - 1, height)), changed); }
    }

    change(column, row, height)
    {
        const action = this.brush.action;

        if(action === "raise") { return SCULPT.step; }
        if(action === "lower") { return -SCULPT.step; }
        if(action === "flatten") { return this.level - height; }

        let sum = 0;
        let count = 0;

        for(let dz = -SCULPT.reach; dz <= SCULPT.reach; dz++)
        {
            for(let dx = -SCULPT.reach; dx <= SCULPT.reach; dx++)
            {
                sum += this.heightOf(column + dx, row + dz);
                count++;
            }
        }

        return sum / count - height;
    }

    /* COLUMNS ****************************************************************/

    // Visits each column within `reach` radii of the dab's middle.
    each(cx, cz, reach, visit)
    {
        const span = Math.ceil(this.radius * reach);

        for(let row = Math.max(0, cz - span); row <= Math.min(this.zone.columns - 1, cz + span); row++)
        {
            for(let column = Math.max(0, cx - span); column <= Math.min(this.zone.columns - 1, cx + span); column++)
            {
                const distance = this.brush.shape === "square" ? Math.max(Math.abs(column - cx), Math.abs(row - cz)) : Math.hypot(column - cx, row - cz);

                if(distance <= span) { visit(column, row, distance); }
            }
        }
    }

    // A placement whose cells reach down to `y` or below covers the column;
    // any placement over it covers it for `y` of Infinity.
    isCovered(column, row, y)
    {
        const lowest = this.cover.get(row * this.zone.columns + column);

        return lowest !== undefined && lowest <= y;
    }

    heightOf(column, row)
    {
        const x = Math.max(0, Math.min(this.zone.columns - 1, column));
        const z = Math.max(0, Math.min(this.zone.columns - 1, row));

        return this.columns.get(z * this.zone.columns + x)?.height ?? this.groundOf(x, z);
    }

    // A raised column keeps its top block on top over its under block; a
    // lowered one takes its top block down, and the cells it leaves fill with
    // water below the zone's water.
    shape(column, row, height, changed)
    {
        const index = row * this.zone.columns + column;

        if(!this.columns.has(index))
        {
            const surface = this.groundOf(column, row);
            const under = this.zone.blockAt(column, surface - 2, row);

            this.columns.set(index, { surface, applied: surface, top: this.zone.blockAt(column, surface - 1, row), under: under === 0 || this.blocks.isLiquid(under) ? this.soft[0] : under });
        }

        const state = this.columns.get(index);
        const top = Math.round(height);

        state.height = height;

        if(top === state.applied) { return; }

        for(let y = Math.min(state.surface, top, state.applied) - 1; y < Math.max(state.surface, top, state.applied); y++)
        {
            let block = this.original(column, y, row);

            if(y === top - 1) { block = state.top; }
            else if(y < top - 1 && y >= state.surface - 1) { block = state.under; }
            else if(y >= top && y < state.surface) { block = y < this.zone.waterCell ? this.water : 0; }

            this.set(column, y, row, block, changed);
        }

        state.applied = top;
    }

    original(x, y, z)
    {
        return this.originals.get(x + "," + y + "," + z) ?? this.zone.blockAt(x, y, z);
    }

    set(x, y, z, block, changed)
    {
        const key = x + "," + y + "," + z;

        if(!this.originals.has(key)) { this.originals.set(key, this.zone.blockAt(x, y, z)); }
        if(this.zone.blockAt(x, y, z) === block) { return; }

        this.latest.set(key, [x, y, z, block]);
        changed.push([x, y, z, block]);
    }
}

function falloff(share)
{
    return share < 1 ? (1 - share * share) ** 2 : 0;
}
