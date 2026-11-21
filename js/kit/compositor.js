import * as Colour from "../art/colour.js";

// Stamp texel kinds, stored in the alpha channel. A tinted texel stores its
// shade in red, as a multiple of GREY.
export const SKIP = 0;
export const CLEAR = 1;
export const TINTED = 128;
export const GLOWING = 254;
export const FIXED = 255;
export const GREY = 96;

const NONE = [0, 0, 0, 0];


/******************************************************************************/
/* COLOURS                                                                    */
/******************************************************************************/

// colours maps a channel name, such as "skin" or "primary", to a colour.
export function resolve(tint, colours)
{
    if(!tint) { return null; }

    let colour = tint.colour ?? colours[tint.of];

    if(!colour) { return null; }
    if(tint.mix) { colour = Colour.mix(colour, colours[tint.mix] ?? tint.mix, tint.amount); }
    if(tint.shade) { colour = Colour.shade(colour, tint.shade); }

    return Colour.rgb(colour);
}


/******************************************************************************/
/* AREAS                                                                      */
/******************************************************************************/

// Rows count from the top, or from the bottom when negative; a value between
// -1 and 1 that is not whole is a fraction of the height. A missing end is the
// bottom edge.
export function rows(area, range)
{
    if(!range) { return area; }

    const whole = (value) => (Number.isInteger(value) ? value : Math.round(value * area.h));
    const edge = (value) => Math.max(0, Math.min(area.h, whole(value) < 0 ? area.h + whole(value) : whole(value)));
    const top = edge(range[0]);
    const bottom = range.length > 1 ? edge(range[1]) : area.h;

    return { x: area.x, y: area.y + top, w: area.w, h: Math.max(0, bottom - top) };
}

function offset(rule, size, extent, random)
{
    if(rule === "tile") { return Math.floor(random.next() * size); }
    if(rule === "centre") { return -Math.floor((extent - size) / 2); }
    if(rule === "bottom" || rule === "right") { return size - extent; }

    return 0;
}


/******************************************************************************/
/* DRAWING                                                                    */
/******************************************************************************/

export function draw(stamps, layer, colour, raster, glow, area, random)
{
    const [sx, sy, sw, sh] = stamps.rect(layer.stamp);
    const target = rows(area, layer.rows);
    const [ruleX, ruleY] = layer.place;
    const offsetX = offset(ruleX, sw, target.w, random);
    const offsetY = offset(ruleY, sh, target.h, random);

    for(let y = 0; y < target.h; y++)
    {
        for(let x = 0; x < target.w; x++)
        {
            const u = ruleX === "tile" ? (x + offsetX) % sw : x + offsetX;
            const v = ruleY === "tile" ? (y + offsetY) % sh : y + offsetY;

            if(u < 0 || v < 0 || u >= sw || v >= sh) { continue; }

            write(stamps.texel(sx + u, sy + v), colour, raster, glow, target.x + x, target.y + y);
        }
    }
}

function write(texel, colour, raster, glow, x, y)
{
    const kind = texel[3];

    if(kind === SKIP) { return; }
    if(kind === CLEAR) { raster.set(x, y, NONE); return; }

    if(kind === TINTED)
    {
        raster.set(x, y, Colour.shade(colour ?? [GREY, GREY, GREY, 255], texel[0] / GREY));
        return;
    }

    const fixed = [texel[0], texel[1], texel[2], 255];

    raster.set(x, y, fixed);

    if(kind === GLOWING) { glow.set(x, y, fixed); }
}

export function painterFaces(stamps, faces, colours, variant)
{
    const worn = (layers) => layers.filter((layer) => !layer.variants || layer.variants.includes(variant));

    return Object.fromEntries(Object.entries(faces).map(([face, layers]) => [face, painter(stamps, worn(layers), colours)]));
}

export function painter(stamps, layers, colours)
{
    const resolved = layers.map((layer) => ({ layer, colour: resolve(layer.tint, colours) }));

    return (raster, area, random, glow) =>
    {
        for(const { layer, colour } of resolved) { draw(stamps, layer, colour, raster, glow, area, random); }
    };
}
