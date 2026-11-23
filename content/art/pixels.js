import * as Colour from "../../js/art/colour.js";

// Painters draw into an area of a raster: { x, y, w, h } with y counting down
// from the top row. Drawing wraps inside the area, so a painted area tiles.

export { mix, rgb, shade } from "../../js/art/colour.js";


/******************************************************************************/
/* AREAS                                                                      */
/******************************************************************************/

export function area(x, y, w, h)
{
    return { x, y, w, h };
}

export function rows(target, from, count)
{
    const top = from < 0 ? target.h + from : from;
    const start = Math.max(0, Math.min(target.h, top));
    const end = Math.max(start, Math.min(target.h, top + count));

    return { x: target.x, y: target.y + start, w: target.w, h: end - start };
}

export function columns(target, from, count)
{
    const left = from < 0 ? target.w + from : from;
    const start = Math.max(0, Math.min(target.w, left));
    const end = Math.max(start, Math.min(target.w, left + count));

    return { x: target.x + start, y: target.y, w: end - start, h: target.h };
}


/******************************************************************************/
/* DRAWING                                                                    */
/******************************************************************************/

export function dot(raster, target, x, y, colour)
{
    if(target.w <= 0 || target.h <= 0) { return; }

    const px = ((Math.floor(x) % target.w) + target.w) % target.w;
    const py = ((Math.floor(y) % target.h) + target.h) % target.h;

    raster.set(target.x + px, target.y + py, Colour.rgb(colour));
}

export function clear(raster, target, x, y)
{
    if(x < 0 || y < 0 || x >= target.w || y >= target.h) { return; }

    raster.set(target.x + x, target.y + y, [0, 0, 0, 0]);
}

export function rect(raster, target, x, y, w, h, colour)
{
    for(let row = y; row < y + h; row++)
    {
        for(let column = x; column < x + w; column++)
        {
            if(column >= 0 && row >= 0 && column < target.w && row < target.h) { dot(raster, target, column, row, colour); }
        }
    }
}

export function fill(raster, target, colour)
{
    rect(raster, target, 0, 0, target.w, target.h, colour);
}

export function grit(raster, target, colour, random, spread = 0.14)
{
    for(let y = 0; y < target.h; y++)
    {
        for(let x = 0; x < target.w; x++) { dot(raster, target, x, y, Colour.shade(colour, 1 - spread / 2 + random.next() * spread)); }
    }
}

export function speckle(raster, target, colours, density, random)
{
    const count = Math.round(target.w * target.h * density);

    for(let i = 0; i < count; i++)
    {
        dot(raster, target, random.next() * target.w, random.next() * target.h, colours[Math.floor(random.next() * colours.length)]);
    }
}


/******************************************************************************/
/* MATERIALS                                                                  */
/******************************************************************************/

export function cloth(raster, target, random, colour)
{
    grit(raster, target, colour, random, 0.14);

    for(let y = 1; y < target.h; y += 3)
    {
        for(let x = 0; x < target.w; x++) { if(random.next() < 0.45) { dot(raster, target, x, y, Colour.shade(colour, 0.84)); } }
    }
}

export function leather(raster, target, random, colour)
{
    grit(raster, target, colour, random, 0.22);
    speckle(raster, target, [Colour.shade(colour, 0.7), Colour.shade(colour, 1.2)], 0.06, random);
}

export function chain(raster, target, random, colour)
{
    for(let y = 0; y < target.h; y++)
    {
        for(let x = 0; x < target.w; x++)
        {
            const isRing = (x + y % 2) % 2 === 0;

            dot(raster, target, x, y, isRing ? Colour.shade(colour, 0.85 + random.next() * 0.35) : Colour.shade(colour, 0.32));
        }
    }
}

export function plate(raster, target, random, colour)
{
    grit(raster, target, colour, random, 0.14);

    for(let y = 5; y < target.h; y += 7)
    {
        for(let x = 0; x < target.w; x++) { dot(raster, target, x, y, Colour.shade(colour, 0.55)); }

        dot(raster, target, 1, y - 2, Colour.shade(colour, 1.5));
        dot(raster, target, target.w - 2, y - 2, Colour.shade(colour, 1.5));
    }

    speckle(raster, target, ["#5e4130", "#6e4a2e"], 0.03, random);
}

export function planks(raster, target, random, colour)
{
    grit(raster, target, colour, random, 0.18);

    for(let x = 0; x < target.w; x += 4)
    {
        for(let y = 0; y < target.h; y++) { dot(raster, target, x, y, Colour.shade(colour, 0.55)); }
    }

    for(let x = 2; x < target.w; x += 4) { dot(raster, target, x, 2, "#1e1c1a"); }
}

export function iron(raster, target, random, colour = "#2a2a2c")
{
    grit(raster, target, colour, random, 0.3);
}

export function glow(raster, target, random, colour = "#f0a848")
{
    grit(raster, target, colour, random, 0.2);
    rect(raster, target, Math.floor(target.w / 2), 0, 1, target.h, "#3a2a1d");
    rect(raster, target, 0, Math.floor(target.h / 2), target.w, 1, "#3a2a1d");
}
