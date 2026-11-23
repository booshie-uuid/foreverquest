import * as Colour from "../../js/art/colour.js";
import * as Surfaces from "./surfaces.js";

// An overlay's alpha is the weathering level, from 1 to 255, at which its
// texel appears: a face at level L shows every texel whose alpha is at most
// L * 255. Alpha 0 never shows. A world cube face is 16 by 16 texels, and a
// texture spans four cubes each way.

const CUBE = 16;

// Value noise on a grid `scale` texels wide that wraps at the texture's size,
// from 0 to 1.
function field(size, scale, seed)
{
    const cells = size / scale;
    const random = mulberry(seed);
    const grid = Array.from({ length: cells * cells }, () => random());
    const smooth = (t) => t * t * (3 - 2 * t);

    return (x, y) =>
    {
        const gx = Math.floor(x / scale);
        const gy = Math.floor(y / scale);
        const fx = smooth(x / scale - gx);
        const fy = smooth(y / scale - gy);
        const at = (cx, cy) => grid[(((cy % cells) + cells) % cells) * cells + (((cx % cells) + cells) % cells)];
        const top = at(gx, gy) + (at(gx + 1, gy) - at(gx, gy)) * fx;
        const bottom = at(gx, gy + 1) + (at(gx + 1, gy + 1) - at(gx, gy + 1)) * fx;

        return top + (bottom - top) * fy;
    };
}

function mulberry(seed)
{
    let state = seed >>> 0;

    return () =>
    {
        state = (state + 0x6d2b79f5) >>> 0;

        let t = state;

        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function put(raster, target, x, y, colour, threshold)
{
    const [r, g, b] = Colour.rgb(colour);
    const alpha = threshold >= 1 ? 0 : Math.max(1, Math.round(threshold * 255));

    raster.set(target.x + x, target.y + y, [r, g, b, alpha]);
}

function clamp(value)
{
    return Math.max(0, Math.min(0.999, value));
}


/******************************************************************************/
/* OVERLAYS                                                                   */
/******************************************************************************/

// Clumps that spread from their middles as the level rises.
export function mossTop(raster, target, random, colour = "#3e4c22")
{
    const clumps = field(target.w, 8, Math.floor(random.next() * 1e9));
    const grain = field(target.w, 2, Math.floor(random.next() * 1e9));

    for(let y = 0; y < target.h; y++)
    {
        for(let x = 0; x < target.w; x++)
        {
            const threshold = clamp(clumps(x, y) * 0.85 + grain(x, y) * 0.3 - 0.1);

            put(raster, target, x, y, Colour.shade(colour, 0.75 + grain(x + 7, y + 3) * 0.5), threshold);
        }
    }
}

// Moss that hangs from the top of each cube face (`fromTop`) or climbs from
// its foot.
export function mossEdge(raster, target, random, fromTop = true, colour = "#3e4c22")
{
    const ragged = field(target.w, 4, Math.floor(random.next() * 1e9));
    const grain = field(target.w, 2, Math.floor(random.next() * 1e9));

    for(let y = 0; y < target.h; y++)
    {
        const depth = (fromTop ? y % CUBE : CUBE - 1 - (y % CUBE)) / CUBE;

        for(let x = 0; x < target.w; x++)
        {
            const threshold = clamp(depth * 1.5 + (ragged(x, y) - 0.5) * 0.5);

            put(raster, target, x, y, Colour.shade(colour, 0.7 + grain(x, y) * 0.5), threshold);
        }
    }
}

// Dark streaks running down a face. The shader multiplies the face by an
// overlay of this kind, so its colours are the darkening.
export function grime(raster, target, random, colour = "#8a8278")
{
    const streaks = field(target.w, 3, Math.floor(random.next() * 1e9));
    const breaks = field(target.w, 6, Math.floor(random.next() * 1e9));

    for(let y = 0; y < target.h; y++)
    {
        for(let x = 0; x < target.w; x++)
        {
            const streak = streaks(x * 4, 0);
            const threshold = clamp((1 - streak) * 0.9 + breaks(x, y) * 0.25 - 0.05);

            put(raster, target, x, y, Colour.shade(colour, 0.85 + streak * 0.25), threshold);
        }
    }
}

// One crack in each cube face, which lengthens as the level rises.
export function cracks(raster, target, random, colour = "#3a3430")
{
    for(let y = 0; y < target.h; y++)
    {
        for(let x = 0; x < target.w; x++) { put(raster, target, x, y, colour, 1); }
    }

    for(let top = 0; top < target.h; top += CUBE)
    {
        for(let left = 0; left < target.w; left += CUBE)
        {
            let x = left + 3 + Math.floor(random.next() * 10);
            let y = top + 1 + Math.floor(random.next() * 3);
            const length = 12 + Math.floor(random.next() * 6);

            for(let step = 0; step < length && y < top + CUBE - 1; step++)
            {
                put(raster, target, x, y, colour, 0.05 + (step / length) * 0.9);

                y += random.next() < 0.7 ? 1 : 0;
                x += Math.floor(random.next() * 3) - 1;
                x = Math.max(left + 1, Math.min(left + CUBE - 2, x));
            }
        }
    }
}


/******************************************************************************/
/* WORN BLOCKS                                                                */
/******************************************************************************/

// Plaster fallen away in patches to show the laths behind.
export function plasterWorn(raster, target, random, colour = "#8c836f")
{
    const patches = field(target.w, 8, Math.floor(random.next() * 1e9));

    Surfaces.plaster(raster, target, random, colour);

    for(let y = 0; y < target.h; y++)
    {
        for(let x = 0; x < target.w; x++)
        {
            const depth = patches(x, y);

            if(depth < 0.62) { continue; }

            const lath = Math.floor(y / 2) % 2 === 0 ? "#5a4430" : "#2e241a";
            const edge = depth < 0.66 ? Colour.shade(colour, 0.7) : Colour.shade(lath, 0.85 + random.next() * 0.3);

            raster.set(target.x + x, target.y + y, edge);
        }
    }
}
