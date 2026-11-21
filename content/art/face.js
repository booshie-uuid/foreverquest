import * as Pixels from "./pixels.js";

// Coordinates assume a 16 by 16 head face, counted from the top-left texel.
const SHORT_HAIR = ["crop", "swept", "tail", "topknot", "braids"];


/******************************************************************************/
/* HAIR                                                                       */
/******************************************************************************/

export function hair(raster, area, random, faceName, style, colour)
{
    const strand = () => Pixels.shade(colour, 0.8 + random.next() * 0.4);
    const depth = { top: area.h, back: 0, side: 0 };

    switch(style)
    {
        case "bald":
            return;
        case "shaved":
        case "crest":
            for(let i = 0; i < area.w * area.h * 0.3; i++) { Pixels.dot(raster, area, random.next() * area.w, random.next() * area.h * (faceName === "top" ? 1 : 0.5), Pixels.shade(colour, 0.7)); }

            if(style === "crest" && faceName === "top") { Pixels.rect(raster, area, 6, 0, 4, area.h, colour); }

            return;
        case "long":
        case "braids":
            depth.back = area.h;
            depth.side = 13;
            break;
        default:
            depth.back = SHORT_HAIR.includes(style) ? 11 : 9;
            depth.side = 7;
    }

    const rowsDown = faceName === "top" ? depth.top : faceName === "back" ? depth.back : depth.side;

    for(let x = 0; x < area.w; x++)
    {
        const ragged = random.next() < 0.5 ? 1 : 0;

        for(let y = 0; y < rowsDown + ragged && y < area.h; y++) { Pixels.dot(raster, area, x, y, strand()); }
    }

    if(faceName === "left" || faceName === "right")
    {
        const front = faceName === "left" ? 0 : area.w - 2;

        Pixels.rect(raster, area, front, rowsDown, 2, 3, colour);
    }
}
