// Painters draw into an area of a raster: { x, y, w, h } with y counting down
// from the top row. Drawing wraps inside the area, so a painted area tiles.

export function rgb(colour)
{
    if(Array.isArray(colour)) { return colour; }

    const value = parseInt(colour.slice(1), 16);

    return [(value >> 16) & 255, (value >> 8) & 255, value & 255, 255];
}

export function shade(colour, factor)
{
    const [r, g, b] = rgb(colour);
    const clamp = (channel) => Math.max(0, Math.min(255, Math.round(channel * factor)));

    return [clamp(r), clamp(g), clamp(b), 255];
}

export function mix(colourA, colourB, amount)
{
    const a = rgb(colourA);
    const b = rgb(colourB);

    return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * amount)).concat(255);
}


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

    raster.set(target.x + px, target.y + py, rgb(colour));
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
        for(let x = 0; x < target.w; x++) { dot(raster, target, x, y, shade(colour, 1 - spread / 2 + random.next() * spread)); }
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
        for(let x = 0; x < target.w; x++) { if(random.next() < 0.45) { dot(raster, target, x, y, shade(colour, 0.84)); } }
    }
}

export function leather(raster, target, random, colour)
{
    grit(raster, target, colour, random, 0.22);
    speckle(raster, target, [shade(colour, 0.7), shade(colour, 1.2)], 0.06, random);
}

export function chain(raster, target, random, colour)
{
    for(let y = 0; y < target.h; y++)
    {
        for(let x = 0; x < target.w; x++)
        {
            const isRing = (x + y % 2) % 2 === 0;

            dot(raster, target, x, y, isRing ? shade(colour, 0.85 + random.next() * 0.35) : shade(colour, 0.32));
        }
    }
}

export function plate(raster, target, random, colour)
{
    grit(raster, target, colour, random, 0.14);

    for(let y = 5; y < target.h; y += 7)
    {
        for(let x = 0; x < target.w; x++) { dot(raster, target, x, y, shade(colour, 0.55)); }

        dot(raster, target, 1, y - 2, shade(colour, 1.5));
        dot(raster, target, target.w - 2, y - 2, shade(colour, 1.5));
    }

    speckle(raster, target, ["#5e4130", "#6e4a2e"], 0.03, random);
}

export function planks(raster, target, random, colour)
{
    grit(raster, target, colour, random, 0.18);

    for(let x = 0; x < target.w; x += 4)
    {
        for(let y = 0; y < target.h; y++) { dot(raster, target, x, y, shade(colour, 0.55)); }
    }

    for(let x = 2; x < target.w; x += 4) { dot(raster, target, x, 2, "#1e1c1a"); }
}

export function timber(raster, target, random, colour = "#3a2a1d")
{
    grit(raster, target, colour, random, 0.12);

    for(let x = 0; x < target.w; x += 2)
    {
        for(let y = 0; y < target.h; y++) { if(random.next() < 0.45) { dot(raster, target, x, y, shade(colour, 0.75)); } }
    }
}

export function plaster(raster, target, random, colour = "#8c836f")
{
    grit(raster, target, colour, random, 0.12);
    speckle(raster, target, [shade(colour, 0.8), shade(colour, 0.7)], 0.04, random);
}

export function stone(raster, target, random, colour = "#6a655c")
{
    fill(raster, target, shade(colour, 0.38));

    for(let y = 0; y < target.h; y += 4)
    {
        let x = Math.floor(random.next() * 6);
        const end = x + target.w;

        while(x < end)
        {
            const length = 3 + Math.floor(random.next() * 5);
            const tone = 0.78 + random.next() * 0.34;

            for(let row = y; row < y + 3; row++)
            {
                for(let column = x; column < x + length - 1; column++) { dot(raster, target, column, row, shade(colour, tone - (random.next() < 0.15 ? 0.12 : 0))); }
            }

            x += length;
        }
    }
}

export function slate(raster, target, random, colour = "#464c56")
{
    fill(raster, target, shade(colour, 0.45));

    for(let y = 0; y < target.h; y += 3)
    {
        const offset = (y / 3) % 2 === 0 ? 0 : 2;

        for(let x = -offset; x < target.w; x += 4)
        {
            const tone = 0.75 + random.next() * 0.4;

            rect(raster, target, Math.max(0, x), y, x < 0 ? 3 + x : 3, 2, shade(colour, tone));
        }
    }
}

export function thatch(raster, target, random, colour = "#6a5a34")
{
    grit(raster, target, shade(colour, 0.7), random, 0.2);

    for(let i = 0; i < target.w * target.h * 0.25; i++)
    {
        const x = random.next() * target.w;
        const y = random.next() * target.h;
        const tone = shade(colour, 0.75 + random.next() * 0.5);

        for(let step = 0; step < 4; step++) { dot(raster, target, x, y + step, tone); }
    }
}

export function bark(raster, target, random, colour = "#2c2621")
{
    grit(raster, target, colour, random, 0.2);

    for(let x = 0; x < target.w; x += 2)
    {
        for(let y = 0; y < target.h; y++) { if(random.next() < 0.35) { dot(raster, target, x, y, shade(colour, 0.6)); } }
    }
}

export function needles(raster, target, random, colour = "#2c3a26")
{
    grit(raster, target, colour, random, 0.3);
    speckle(raster, target, [shade(colour, 1.35), shade(colour, 0.6)], 0.2, random);
}

export function grass(raster, target, random, colour = "#3f4428")
{
    grit(raster, target, colour, random, 0.26);
    speckle(raster, target, ["#5d5a33", "#2f3420", "#4c4a2a"], 0.12, random);
}

export function mud(raster, target, random, colour = "#3c3024")
{
    grit(raster, target, colour, random, 0.22);

    for(let i = 0; i < 3; i++)
    {
        rect(raster, target, Math.floor(random.next() * target.w), Math.floor(random.next() * target.h), 2 + Math.floor(random.next() * 4), 1 + Math.floor(random.next() * 2), shade(colour, 0.6));
    }
}

export function cobble(raster, target, random, colour = "#5a5650")
{
    fill(raster, target, shade(colour, 0.35));

    for(let y = 0; y < target.h; y += 3)
    {
        for(let x = ((y / 3) % 2) * 1.5; x < target.w; x += 3) { rect(raster, target, Math.floor(x), y, 2, 2, shade(colour, 0.75 + random.next() * 0.4)); }
    }
}

export function earth(raster, target, random, colour = "#3a2e23")
{
    grit(raster, target, colour, random, 0.2);
    speckle(raster, target, ["#56504a", "#2a2219"], 0.05, random);
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
