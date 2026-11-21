import * as Pixels from "./pixels.js";

// Coordinates assume a 16 by 16 head face, counted from the top-left texel.
const SHORT_HAIR = ["crop", "swept", "tail", "topknot", "braids"];

export function front(raster, area, random, look)
{
    const { skin, hairColour, eyes, face, beard, markings, hair, isFemale } = look;
    const brow = Pixels.shade(hairColour, 0.75);
    const shadow = Pixels.shade(skin, 0.82);
    const dark = Pixels.shade(skin, 0.6);

    Pixels.grit(raster, area, skin, random, 0.08);
    paintHairline(raster, area, random, hair, hairColour);

    const browRow = 6 - face.brow;

    Pixels.rect(raster, area, 3, browRow, 4, 1, brow);
    Pixels.rect(raster, area, 9, browRow, 4, 1, brow);

    if(face.brow < 0)
    {
        Pixels.dot(raster, area, 6, browRow + 1, brow);
        Pixels.dot(raster, area, 9, browRow + 1, brow);
    }

    paintEyes(raster, area, eyes, face, isFemale, skin);

    if(face.lines >= 1)
    {
        Pixels.rect(raster, area, 3, 10, 3, 1, shadow);
        Pixels.rect(raster, area, 10, 10, 3, 1, shadow);
    }

    if(face.lines >= 2)
    {
        Pixels.rect(raster, area, 2, 10, 1, 4, shadow);
        Pixels.rect(raster, area, 13, 10, 1, 4, shadow);
    }

    Pixels.rect(raster, area, 7, 12, 2, 1, shadow);
    paintMouth(raster, area, face, skin, isFemale, dark);
    Pixels.rect(raster, area, 4, 15, 8, 1, Pixels.shade(skin, 0.9));

    paintBeard(raster, area, random, beard, hairColour, skin);
    paintMarkings(raster, area, random, markings, skin);
}

function paintHairline(raster, area, random, hair, colour)
{
    if(hair === "bald") { return; }

    if(hair === "shaved" || hair === "crest")
    {
        for(let x = 0; x < 16; x++) { if(random.next() < 0.5) { Pixels.dot(raster, area, x, 0, Pixels.shade(colour, 0.7)); } }

        return;
    }

    const depth = hair === "swept" ? 2 : 3;

    for(let x = 0; x < 16; x++)
    {
        const extra = x < 2 || x > 13 ? 3 : random.next() < 0.4 ? 1 : 0;

        Pixels.rect(raster, area, x, 0, 1, depth + extra, Pixels.shade(colour, 0.85 + random.next() * 0.3));
    }
}

function paintEyes(raster, area, eyes, face, isFemale, skin)
{
    const white = "#c9c0ae";
    const lid = isFemale ? "#1e1612" : Pixels.shade(skin, 0.55);
    const height = face.eyes;

    for(const left of [3, 10])
    {
        Pixels.rect(raster, area, left, 8, 3, height, white);
        Pixels.rect(raster, area, left + 1, 8, 1, height, eyes);
        Pixels.rect(raster, area, left, 7, 3, 1, lid);
    }
}

function paintMouth(raster, area, face, skin, isFemale, dark)
{
    const lips = isFemale ? Pixels.mix(skin, "#6a2a2a", 0.45) : dark;

    if(face.mouth === 2)
    {
        Pixels.rect(raster, area, 5, 13, 6, 1, lips);
    }
    else
    {
        Pixels.rect(raster, area, 6, 13, 4, 1, lips);
    }

    if(face.mouth === 1)
    {
        Pixels.dot(raster, area, 5, 14, dark);
        Pixels.dot(raster, area, 10, 14, dark);
    }
}

function paintBeard(raster, area, random, beard, colour, skin)
{
    if(beard === "none") { return; }

    const hair = () => Pixels.shade(colour, 0.8 + random.next() * 0.4);
    const stubble = Pixels.mix(skin, colour, 0.3);

    for(let y = 11; y < 16; y++)
    {
        for(let x = 2; x < 14; x++)
        {
            const isMouth = y === 13 && x >= 6 && x <= 9;

            if(isMouth) { continue; }

            if(beard === "stubble")
            {
                if(y >= 12 && random.next() < 0.3) { Pixels.dot(raster, area, x, y, stubble); }
            }
            else if(beard === "moustache")
            {
                if(y === 12 && x >= 5 && x <= 10) { Pixels.dot(raster, area, x, y, hair()); }
            }
            else if(y >= 12 || x <= 3 || x >= 12)
            {
                Pixels.dot(raster, area, x, y, hair());
            }
        }
    }
}

function paintMarkings(raster, area, random, markings, skin)
{
    switch(markings)
    {
        case "scar":
            for(let i = 0; i < 8; i++) { Pixels.dot(raster, area, 3 + i * 0.5, 4 + i, Pixels.mix(skin, "#d8a8a0", 0.5)); }

            break;
        case "weathered":
            Pixels.rect(raster, area, 4, 4, 3, 1, Pixels.shade(skin, 0.85));
            Pixels.rect(raster, area, 9, 4, 3, 1, Pixels.shade(skin, 0.85));
            Pixels.dot(raster, area, 2, 8, Pixels.shade(skin, 0.8));
            Pixels.dot(raster, area, 13, 8, Pixels.shade(skin, 0.8));
            break;
        case "warpaint":
            Pixels.rect(raster, area, 1, 7, 14, 1, "#1c1c1e");
            Pixels.rect(raster, area, 1, 9, 2, 3, "#1c1c1e");
            Pixels.rect(raster, area, 13, 9, 2, 3, "#1c1c1e");
            break;
        case "tattoo":
            for(const [x, y] of [[11, 3], [12, 4], [13, 5], [13, 6], [14, 8], [13, 10], [12, 11], [12, 12], [11, 13]]) { Pixels.dot(raster, area, x, y, "#2a3448"); }

            break;
        default:
            break;
    }
}


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
