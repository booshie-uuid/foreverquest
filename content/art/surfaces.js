import * as Colour from "../../js/art/colour.js";
import * as Pixels from "./pixels.js";

// A world cube face is 16 by 16 texels. Every pattern wraps, so a painted
// area tiles.

const CUBE = 16;
const HALF = CUBE / 2;
const LEAD = "#2a2622";
const STAINED = ["#1a2860", "#1a2860", "#1a2860", "#22306e", "#6a1a1c", "#6a1a1c", "#8a6a26", "#2a4430"];


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
/* NATURAL ROCK                                                               */
/******************************************************************************/

// Rock as it lies in a cliff: weathered patches, cracks and lichen.
export function crag(raster, target, random, colour = "#55514a")
{
    Pixels.grit(raster, target, colour, random, 0.2);
    blots(raster, target, random, Colour.shade(colour, 1.18), 9, 4, 10);
    blots(raster, target, random, Colour.shade(colour, 0.8), 9, 3, 8);
    fractures(raster, target, random, colour, 0.3);
    Pixels.speckle(raster, target, ["#5a5c40", "#66624c", "#4a4e36"], 0.012, random);
}

// Dark cracks that wander downwards, each lit on one side.
function fractures(raster, target, random, colour, density)
{
    for(let i = 0; i < target.w * density; i++)
    {
        let x = Math.floor(random.next() * target.w);
        let y = Math.floor(random.next() * target.h);
        const length = 3 + Math.floor(random.next() * 6);

        for(let step = 0; step < length; step++)
        {
            Pixels.dot(raster, target, x, y, Colour.shade(colour, 0.48));
            Pixels.dot(raster, target, x + 1, y, Colour.shade(colour, 1.2));
            y += 1;
            x += Math.floor(random.next() * 3) - 1;
        }
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
/* SMALL OBJECTS                                                              */
/******************************************************************************/

// Each wave repeats a whole number of times across the area, so the swell
// tiles.
function smooth(raster, target, random, colour, swell, spread)
{
    const waves = [0, 1].map(() => ({ across: 1 + Math.floor(random.next() * 2), down: 1 + Math.floor(random.next() * 2), phase: random.next() * Math.PI * 2 }));

    for(let y = 0; y < target.h; y++)
    {
        for(let x = 0; x < target.w; x++)
        {
            const wave = waves.reduce((sum, { across, down, phase }) => sum + Math.cos(2 * Math.PI * (across * x / target.w + down * y / target.h) + phase), 0) / waves.length;

            Pixels.dot(raster, target, x, y, tone(Colour.shade(colour, 1 + wave * swell), random, spread));
        }
    }
}

export function bottleGlass(raster, target, random, colour)
{
    smooth(raster, target, random, colour, 0.1, 0.03);
    strokes(raster, target, random, [Colour.shade(colour, 1.35), Colour.shade(colour, 1.2)], target.w * 0.25, 3, 8, 0, 1);
    Pixels.speckle(raster, target, [Colour.shade(colour, 1.9)], 0.006, random);
}

// Dark runs where the glaze pooled as it fired, and a few bright glints.
export function glaze(raster, target, random, colour)
{
    smooth(raster, target, random, colour, 0.08, 0.03);
    strokes(raster, target, random, [Colour.shade(colour, 0.82)], target.w * 0.3, 4, 12, 0, 1);
    strokes(raster, target, random, [Colour.shade(colour, 1.5)], target.w * 0.15, 2, 5, 0, 1);
}

// Fine polish lines, a soft shine and a few spots of tarnish.
export function polishedMetal(raster, target, random, colour, tarnish)
{
    smooth(raster, target, random, colour, 0.08, 0.04);
    strokes(raster, target, random, [Colour.shade(colour, 1.14)], target.h * 0.25, 4, 12, 1, 0);
    blots(raster, target, random, Colour.mix(colour, tarnish, 0.5), 3, 1, 2.5);
    Pixels.speckle(raster, target, [Colour.shade(colour, 1.6)], 0.005, random);
}

export function polishedWood(raster, target, random, colour)
{
    smooth(raster, target, random, colour, 0.06, 0.03);
    strokes(raster, target, random, [Colour.shade(colour, 0.8), Colour.shade(colour, 0.88)], target.w * 1.5, 8, 24, 1, 0);
    strokes(raster, target, random, [Colour.shade(colour, 1.15)], target.w * 0.3, 4, 10, 1, 0);
}

export function leather(raster, target, random, colour)
{
    smooth(raster, target, random, colour, 0.1, 0.06);
    Pixels.speckle(raster, target, [Colour.shade(colour, 0.78)], 0.04, random);
    strokes(raster, target, random, [Colour.shade(colour, 0.7)], target.w * 0.25, 2, 5, 1, 1);
    Pixels.speckle(raster, target, [Colour.shade(colour, 1.2)], 0.015, random);
}

export function parchment(raster, target, random, colour)
{
    smooth(raster, target, random, colour, 0.08, 0.04);
    blots(raster, target, random, Colour.shade(colour, 0.9), 5, 2, 6);
    Pixels.speckle(raster, target, [Colour.shade(colour, 0.7)], 0.01, random);
}

// A line of type on every third row, broken into words.
export function print(raster, target, random, colour, ink = "#5a4a3a")
{
    parchment(raster, target, random, colour);

    for(let y = 1; y < target.h; y += 3)
    {
        for(let x = 0; x < target.w;)
        {
            const word = 2 + Math.floor(random.next() * 5);

            for(let i = 0; i < word; i++) { Pixels.dot(raster, target, x + i, y, tone(ink, random, 0.2)); }

            x += word + 1 + Math.floor(random.next() * 3);
        }
    }
}

// Runs where the wax dripped.
export function wax(raster, target, random, colour)
{
    smooth(raster, target, random, colour, 0.05, 0.02);
    strokes(raster, target, random, [Colour.shade(colour, 0.92)], target.w * 0.2, 3, 8, 0, 1);
}

// Strands over and under in squares of four texels, each dark in the gap
// before it and lit along its first row.
export function wicker(raster, target, random, colour)
{
    const size = 4;

    for(let y = 0; y < target.h; y++)
    {
        for(let x = 0; x < target.w; x++)
        {
            const isAcross = (Math.floor(x / size) + Math.floor(y / size)) % 2 === 0;
            const step = isAcross ? y % size : x % size;
            const factor = step === 0 ? 0.62 : (step === 1 ? 1.15 : 1);

            Pixels.dot(raster, target, x, y, tone(Colour.shade(colour, factor), random, 0.1));
        }
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

// Worn plate steel: grey, with fine scratches, a little rust and grime.
export function steel(raster, target, random, colour = "#5e6166")
{
    Pixels.grit(raster, target, colour, random, 0.12);
    strokes(raster, target, random, [Colour.shade(colour, 1.22), Colour.shade(colour, 1.1)], target.w * 0.4, 3, 9, 1, 0);
    blots(raster, target, random, "#4e3426", 3, 1, 2.5);
    Pixels.speckle(raster, target, [Colour.shade(colour, 0.7)], 0.02, random);
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

// A texel's alpha is how much of what lies behind the pane it hides. A
// quarry cut by the texture's edge continues on the far edge, so its number
// wraps.
export function glass(raster, target, random, style)
{
    const quarries = new Map();
    const across = target.w / HALF;

    for(let y = 0; y < target.h; y++)
    {
        for(let x = 0; x < target.w; x++)
        {
            const isLead = style !== "clear" && ((x + y) % HALF === 0 || (x - y + target.w) % HALF === 0);
            const quarry = Math.floor((x + y) / HALF) % across + "," + Math.floor((x - y + target.w) / HALF) % across;

            if(!quarries.has(quarry)) { quarries.set(quarry, { colour: pick(STAINED, random), dirt: random.next() }); }

            Pixels.dot(raster, target, x, y, isLead ? LEAD : pane(style, quarries.get(quarry), y % CUBE / CUBE, random));
        }
    }
}

function pane(style, quarry, depth, random)
{
    if(style === "stained") { return withAlpha(tone(quarry.colour, random, 0.2), 200); }

    if(style === "grimy")
    {
        const dirt = Math.min(1, quarry.dirt * 0.5 + depth * depth * 0.6 + random.next() * 0.2);

        return withAlpha(tone(Colour.mix("#8a9a8a", "#4a4232", dirt), random, 0.1), Math.round(90 + dirt * 140));
    }

    if(random.next() < 0.04) { return withAlpha("#d8e4dc", 120); }

    return style === "clear" ? withAlpha(tone("#b0c0bc", random, 0.12), 40) : withAlpha(tone("#94aca0", random, 0.12), 70);
}

function withAlpha(colour, alpha)
{
    const [r, g, b] = Colour.rgb(colour);

    return [r, g, b, alpha];
}
