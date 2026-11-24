import * as Colour from "../../js/art/colour.js";
import * as Pixels from "./pixels.js";

// A world cube face is 16 by 16 texels. Every pattern wraps, so a painted
// area tiles.

const CUBE = 16;
const HALF = CUBE / 2;


/******************************************************************************/
/* HELPERS                                                                    */
/******************************************************************************/

// The pieces add up to the total exactly, so a row of them wraps without a
// seam.
function lengths(total, shortest, longest, random)
{
    const pieces = [];
    let left = total;

    while(left > longest)
    {
        const piece = shortest + Math.floor(random.next() * (longest - shortest + 1));

        pieces.push(Math.min(piece, left - shortest));
        left -= pieces.at(-1);
    }

    pieces.push(left);

    return pieces;
}

function pick(list, random)
{
    return list[Math.floor(random.next() * list.length)];
}

function tone(colour, random, spread)
{
    return Colour.shade(colour, 1 - spread / 2 + random.next() * spread);
}

function block(raster, target, x, y, w, h, colour, random, rounded = false)
{
    for(let row = 0; row < h; row++)
    {
        for(let column = 0; column < w; column++)
        {
            const isJoint = row === h - 1 || column === w - 1;
            const isCorner = rounded && (row === 0 || row === h - 2) && (column === 0 || column === w - 2);
            let factor = 1;

            if(isJoint || isCorner)
            {
                Pixels.dot(raster, target, x + column, y + row, Colour.shade(colour, 0.42));
                continue;
            }

            if(row === 0 || column === 0) { factor = 1.16; }
            if(row === h - 2 || column === w - 2) { factor = 0.8; }

            Pixels.dot(raster, target, x + column, y + row, tone(Colour.shade(colour, factor), random, 0.1));
        }
    }
}

function courses(raster, target, random, colour, heights, widths, spread)
{
    let y = 0;

    for(const height of heights)
    {
        let x = Math.floor(random.next() * target.w);

        for(const width of widths(random))
        {
            block(raster, target, x, y, width, height, Colour.shade(colour, 1 - spread / 2 + random.next() * spread), random);
            x += width;
        }

        y += height;
    }
}

function strokes(raster, target, random, colours, count, shortest, longest, dx, dy)
{
    for(let i = 0; i < count; i++)
    {
        const x = Math.floor(random.next() * target.w);
        const y = Math.floor(random.next() * target.h);
        const length = shortest + Math.floor(random.next() * (longest - shortest + 1));
        const colour = pick(colours, random);

        for(let step = 0; step < length; step++) { Pixels.dot(raster, target, x + step * dx, y + step * dy, colour); }
    }
}

function blots(raster, target, random, colour, count, smallest, largest)
{
    for(let i = 0; i < count; i++)
    {
        const cx = random.next() * target.w;
        const cy = random.next() * target.h;
        const rx = smallest + random.next() * (largest - smallest);
        const ry = rx * (0.5 + random.next() * 0.5);

        for(let y = Math.floor(-ry); y <= ry; y++)
        {
            for(let x = Math.floor(-rx); x <= rx; x++)
            {
                if((x / rx) ** 2 + (y / ry) ** 2 <= 1) { Pixels.dot(raster, target, cx + x, cy + y, tone(colour, random, 0.08)); }
            }
        }
    }
}


/******************************************************************************/
/* GROUND                                                                     */
/******************************************************************************/

export function grass(raster, target, random, colour = "#3f4428")
{
    Pixels.grit(raster, target, colour, random, 0.2);
    blots(raster, target, random, Colour.shade(colour, 0.88), 6, 4, 9);
    strokes(raster, target, random, [Colour.shade(colour, 1.35), "#5d5a33", "#4c4a2a"], target.w * target.h * 0.07, 2, 3, 0, -1);
    strokes(raster, target, random, [Colour.shade(colour, 0.62), "#2f3420"], target.w * target.h * 0.04, 1, 2, 0, -1);
}

export function mud(raster, target, random, colour = "#3c3024")
{
    Pixels.grit(raster, target, colour, random, 0.2);
    blots(raster, target, random, Colour.shade(colour, 0.7), 5, 4, 10);
    strokes(raster, target, random, [Colour.shade(colour, 0.6)], target.w * 0.25, 3, 7, 1, 0);
    Pixels.speckle(raster, target, ["#5a5246", "#4a443a"], 0.012, random);
}

export function sand(raster, target, random, colour = "#5e5644")
{
    Pixels.grit(raster, target, colour, random, 0.16);
    strokes(raster, target, random, [Colour.shade(colour, 0.86)], target.h * 0.5, 4, 10, 1, 0);
    Pixels.speckle(raster, target, [Colour.shade(colour, 0.7), Colour.shade(colour, 1.2)], 0.03, random);
}

export function earth(raster, target, random, colour = "#3a2e23")
{
    Pixels.grit(raster, target, colour, random, 0.2);
    blots(raster, target, random, Colour.shade(colour, 0.85), 5, 3, 7);
    strokes(raster, target, random, ["#2a2219"], target.w * 0.25, 3, 6, 1, 0);

    for(let i = 0; i < target.w * 0.5; i++)
    {
        const x = Math.floor(random.next() * target.w);
        const y = Math.floor(random.next() * target.h);
        const grey = pick(["#56504a", "#4a4640", "#625b52"], random);

        Pixels.rect(raster, target, x, y, 2, 1, grey);
        Pixels.dot(raster, target, x, y + 1, Colour.shade(grey, 0.6));
    }
}

// A texture spans four cubes, so the fringe tops every cube face.
export function edged(raster, target, random, base, colour)
{
    base(raster, target, random);

    for(let top = 0; top < target.h; top += CUBE)
    {
        for(let x = 0; x < target.w; x++)
        {
            const depth = 2 + Math.floor(random.next() * 3) + (random.next() < 0.2 ? 2 : 0);

            for(let y = 0; y < depth; y++) { Pixels.dot(raster, target, x, top + y, tone(y === depth - 1 ? Colour.shade(colour, 0.7) : colour, random, 0.22)); }
        }
    }
}

export function water(raster, target, random, colour = "#1e3034")
{
    Pixels.grit(raster, target, colour, random, 0.1);
    strokes(raster, target, random, [Colour.shade(colour, 1.35), Colour.shade(colour, 1.18)], target.w * 0.8, 3, 8, 1, 0);
    strokes(raster, target, random, [Colour.shade(colour, 0.8)], target.w * 0.5, 4, 10, 1, 0);
}

export function cobble(raster, target, random, colour = "#5a5650")
{
    Pixels.fill(raster, target, Colour.shade(colour, 0.32));

    let y = 0;

    for(const height of lengths(target.h, 6, 8, random))
    {
        let x = Math.floor(random.next() * target.w);

        for(const width of lengths(target.w, 6, 9, random))
        {
            block(raster, target, x, y, width, height, Colour.shade(colour, 0.78 + random.next() * 0.36), random, true);
            x += width;
        }

        y += height;
    }
}


/******************************************************************************/
/* MASONRY                                                                    */
/******************************************************************************/

export function stone(raster, target, random, colour = "#6a655c")
{
    const heights = new Array(target.h / HALF).fill(HALF);

    courses(raster, target, random, colour, heights, (rng) => lengths(target.w / HALF, 1, 3, rng).map((halves) => halves * HALF), 0.3);
}

export function rubble(raster, target, random, colour = "#4e4a44")
{
    Pixels.fill(raster, target, Colour.shade(colour, 0.38));
    courses(raster, target, random, colour, lengths(target.h, 4, 7, random), (rng) => lengths(target.w, 4, 11, rng), 0.36);
}

export function slab(raster, target, random, colour = "#7a776e")
{
    for(let y = 0; y < target.h; y += CUBE)
    {
        for(let x = 0; x < target.w; x += CUBE) { block(raster, target, x, y, CUBE, CUBE, Colour.shade(colour, 0.9 + random.next() * 0.18), random); }
    }

    strokes(raster, target, random, [Colour.shade(colour, 0.55)], target.w * 0.12, 2, 5, 1, 1);
    Pixels.speckle(raster, target, ["#4a5438", "#5c6440"], 0.01, random);
}

export function plaster(raster, target, random, colour = "#8c836f")
{
    Pixels.grit(raster, target, colour, random, 0.08);
    blots(raster, target, random, Colour.shade(colour, 0.93), 8, 3, 8);
    Pixels.speckle(raster, target, [Colour.shade(colour, 0.8), Colour.shade(colour, 0.72)], 0.02, random);
}


/******************************************************************************/
/* WOOD                                                                       */
/******************************************************************************/

export function timber(raster, target, random, colour = "#3a2a1d")
{
    Pixels.grit(raster, target, colour, random, 0.12);
    strokes(raster, target, random, [Colour.shade(colour, 0.72), Colour.shade(colour, 0.82)], target.w * 3, 6, 18, 0, 1);
    strokes(raster, target, random, [Colour.shade(colour, 1.18)], target.w, 4, 10, 0, 1);

    for(let i = 0; i < 3; i++)
    {
        const x = Math.floor(random.next() * target.w);
        const y = Math.floor(random.next() * target.h);

        Pixels.rect(raster, target, x, y, 2, 3, Colour.shade(colour, 0.5));
        Pixels.dot(raster, target, x, y - 1, Colour.shade(colour, 0.7));
        Pixels.dot(raster, target, x + 1, y + 3, Colour.shade(colour, 0.7));
    }
}

export function planks(raster, target, random, colour)
{
    Pixels.grit(raster, target, colour, random, 0.14);
    strokes(raster, target, random, [Colour.shade(colour, 0.78), Colour.shade(colour, 1.12)], target.w * 2, 5, 14, 0, 1);

    for(let x = 0; x < target.w; x += HALF)
    {
        const board = Colour.shade(colour, 0.88 + random.next() * 0.24);

        for(let y = 0; y < target.h; y++)
        {
            Pixels.dot(raster, target, x, y, Colour.shade(colour, 0.45));
            Pixels.dot(raster, target, x + 1, y, Colour.mix(board, Colour.shade(colour, 1.15), 0.5));
        }

        let y = Math.floor(random.next() * target.h);

        for(const length of lengths(target.h, 20, 40, random))
        {
            Pixels.rect(raster, target, x + 1, y, HALF - 1, 1, Colour.shade(colour, 0.5));
            Pixels.dot(raster, target, x + 3, y + 2, "#1e1c1a");
            Pixels.dot(raster, target, x + HALF - 3, y + 2, "#1e1c1a");
            y = (y + length) % target.h;
        }
    }
}

export function bark(raster, target, random, colour = "#2c2621")
{
    Pixels.grit(raster, target, colour, random, 0.18);
    strokes(raster, target, random, [Colour.shade(colour, 1.3), Colour.shade(colour, 1.18)], target.w * 2, 4, 12, 0, 1);
    strokes(raster, target, random, [Colour.shade(colour, 0.5)], target.w * 2.5, 6, 20, 0, 1);
    Pixels.speckle(raster, target, ["#3a4228", "#444a2c"], 0.01, random);
}


/******************************************************************************/
/* ROOFS AND FOLIAGE                                                          */
/******************************************************************************/

export function slate(raster, target, random, colour = "#464c56")
{
    Pixels.fill(raster, target, Colour.shade(colour, 0.4));

    for(let y = 0; y < target.h; y += HALF)
    {
        const offset = (y / HALF) % 2 === 0 ? 0 : HALF / 2 + 2;

        for(let x = offset; x < offset + target.w; x += HALF)
        {
            const shade = Colour.shade(colour, 0.78 + random.next() * 0.36);

            for(let row = 0; row < HALF - 1; row++)
            {
                const factor = row < 2 ? 0.72 : row === HALF - 2 ? 1.12 : 1;

                for(let column = 0; column < HALF - 1; column++) { Pixels.dot(raster, target, x + column, y + row, tone(Colour.shade(shade, factor), random, 0.08)); }
            }
        }
    }
}

export function thatch(raster, target, random, colour = "#6a5a34")
{
    Pixels.grit(raster, target, Colour.shade(colour, 0.62), random, 0.2);
    strokes(raster, target, random, [Colour.shade(colour, 0.8), Colour.shade(colour, 1), Colour.shade(colour, 1.2), Colour.shade(colour, 0.9)], target.w * target.h * 0.09, 6, 14, 0, 1);

    for(let y = CUBE - 2; y < target.h; y += CUBE)
    {
        for(let x = 0; x < target.w; x++) { if(random.next() < 0.7) { Pixels.dot(raster, target, x, y, Colour.shade(colour, 0.45)); } }
    }
}

export function needles(raster, target, random, colour = "#2c3a26")
{
    Pixels.grit(raster, target, Colour.shade(colour, 0.8), random, 0.3);

    const tones = [Colour.shade(colour, 1.4), Colour.shade(colour, 1.15), Colour.shade(colour, 0.55)];

    strokes(raster, target, random, tones, target.w * target.h * 0.08, 2, 4, 1, 1);
    strokes(raster, target, random, tones, target.w * target.h * 0.08, 2, 4, -1, 1);
}

export function leaves(raster, target, random, colour = "#3a3f24")
{
    Pixels.grit(raster, target, Colour.shade(colour, 0.7), random, 0.3);

    for(let i = 0; i < target.w * target.h * 0.06; i++)
    {
        const x = Math.floor(random.next() * target.w);
        const y = Math.floor(random.next() * target.h);
        const leaf = Colour.shade(colour, 0.85 + random.next() * 0.6);

        Pixels.rect(raster, target, x, y, 2, 2, leaf);
        Pixels.dot(raster, target, x, y, Colour.shade(leaf, 1.2));
        Pixels.dot(raster, target, x + 1, y + 2, Colour.shade(leaf, 0.6));
    }
}


/******************************************************************************/
/* METAL, CLOTH AND LIGHT                                                     */
/******************************************************************************/

export function iron(raster, target, random, colour = "#2a2a2c")
{
    Pixels.grit(raster, target, colour, random, 0.24);
    blots(raster, target, random, "#3a2a22", 4, 2, 5);
    Pixels.speckle(raster, target, [Colour.shade(colour, 1.6)], 0.01, random);
}

export function weave(raster, target, random, colour)
{
    for(let y = 0; y < target.h; y++)
    {
        for(let x = 0; x < target.w; x++) { Pixels.dot(raster, target, x, y, tone(Colour.shade(colour, (x + y) % 2 === 0 ? 1.06 : 0.9), random, 0.1)); }
    }

    strokes(raster, target, random, [Colour.shade(colour, 0.75)], target.h * 0.5, 6, 20, 1, 0);
}

export function banner(raster, target, random, colour)
{
    weave(raster, target, random, colour);

    for(let x = 0; x < target.w; x++)
    {
        const fold = 0.86 + 0.14 * Math.cos((x / HALF) * Math.PI);

        for(let y = 0; y < target.h; y++) { if(fold < 0.8 && random.next() < 0.6) { Pixels.dot(raster, target, x, y, Colour.shade(colour, fold)); } }
    }
}

// Coals: dark lumps with red and orange between them.
export function embers(raster, target, random)
{
    for(let y = 0; y < target.h; y++)
    {
        for(let x = 0; x < target.w; x++)
        {
            const heat = random.next();
            const colour = heat < 0.3 ? "#2a1610" : heat < 0.75 ? "#b8361a" : "#f08a2c";

            Pixels.dot(raster, target, x, y, tone(colour, random, 0.18));
        }
    }
}

export function glow(raster, target, random, colour = "#f0a848")
{
    for(let y = 0; y < target.h; y++)
    {
        for(let x = 0; x < target.w; x++)
        {
            const isLead = (x + y) % HALF === 0 || (x - y + target.w) % HALF === 0;

            Pixels.dot(raster, target, x, y, isLead ? "#3a2a1d" : tone(colour, random, 0.24));
        }
    }
}
