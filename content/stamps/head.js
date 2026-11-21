import * as Face from "../../js/art/face.js";
import * as Pixels from "../../js/art/pixels.js";

const HEAD = [16, 16];
const WHITE = "#c9c0ae";
const SIDES = ["top", "back", "left", "right"];

// Face shapes by face id: brow raise, eye height, line depth and mouth shape.
export const FACES =
{
    1: { name: "Stern", brow: 0, eyes: 1, lines: 0, mouth: 0 },
    2: { name: "Weary", brow: 1, eyes: 1, lines: 1, mouth: 0 },
    3: { name: "Gaunt", brow: 0, eyes: 1, lines: 2, mouth: 1 },
    4: { name: "Broad", brow: -1, eyes: 1, lines: 0, mouth: 2 },
    5: { name: "Young", brow: 1, eyes: 2, lines: 0, mouth: 0 },
    6: { name: "Grim", brow: -1, eyes: 1, lines: 1, mouth: 1 },
};

/* FACES **********************************************************************/

function brows(face)
{
    return (r, a, random, colour) =>
    {
        const row = 6 - face.brow;

        Pixels.rect(r, a, 3, row, 4, 1, colour);
        Pixels.rect(r, a, 9, row, 4, 1, colour);

        if(face.brow < 0)
        {
            Pixels.dot(r, a, 6, row + 1, colour);
            Pixels.dot(r, a, 9, row + 1, colour);
        }
    };
}

function eyes(height)
{
    return (r, a, random, colour) =>
    {
        for(const left of [3, 10])
        {
            Pixels.rect(r, a, left, 8, 3, height, WHITE);
            Pixels.rect(r, a, left + 1, 8, 1, height, colour);
        }
    };
}

function lids(r, a, random, colour)
{
    for(const left of [3, 10]) { Pixels.rect(r, a, left, 7, 3, 1, colour); }
}

function skin(face)
{
    return (r, a, random, colour) =>
    {
        const shadow = Pixels.shade(colour, 0.82);

        if(face.lines >= 1)
        {
            Pixels.rect(r, a, 3, 10, 3, 1, shadow);
            Pixels.rect(r, a, 10, 10, 3, 1, shadow);
        }

        if(face.lines >= 2)
        {
            Pixels.rect(r, a, 2, 10, 1, 4, shadow);
            Pixels.rect(r, a, 13, 10, 1, 4, shadow);
        }

        Pixels.rect(r, a, 7, 12, 2, 1, shadow);
        Pixels.rect(r, a, 4, 15, 8, 1, Pixels.shade(colour, 0.9));

        if(face.mouth === 1)
        {
            Pixels.dot(r, a, 5, 14, Pixels.shade(colour, 0.6));
            Pixels.dot(r, a, 10, 14, Pixels.shade(colour, 0.6));
        }
    };
}

function mouth(face)
{
    return (r, a, random, colour) =>
    {
        if(face.mouth === 2) { Pixels.rect(r, a, 5, 13, 6, 1, colour); }
        else { Pixels.rect(r, a, 6, 13, 4, 1, colour); }
    };
}

/* HAIR AND BEARDS ************************************************************/

function hairline(depth)
{
    return (r, a, random, colour) =>
    {
        for(let x = 0; x < 16; x++)
        {
            const extra = x < 2 || x > 13 ? 3 : random.next() < 0.4 ? 1 : 0;

            Pixels.rect(r, a, x, 0, 1, depth + extra, Pixels.shade(colour, 0.85 + random.next() * 0.3));
        }
    };
}

function stubbleLine(r, a, random, colour)
{
    for(let x = 0; x < 16; x++)
    {
        if(random.next() < 0.5) { Pixels.dot(r, a, x, 0, Pixels.shade(colour, 0.7)); }
    }
}

function scalp(style, side)
{
    return (r, a, random, colour) => Face.hair(r, a, random, side, style, colour);
}

// Rows 11 to 15 of the face, leaving the mouth open.
function beard(isTexelled, isShaded = true)
{
    return (r, a, random, colour) =>
    {
        for(let y = 11; y < 16; y++)
        {
            for(let x = 2; x < 14; x++)
            {
                const isMouth = y === 13 && x >= 6 && x <= 9;

                if(!isMouth && isTexelled(x, y, random)) { Pixels.dot(r, a, x, y, isShaded ? Pixels.shade(colour, 0.8 + random.next() * 0.4) : colour); }
            }
        }
    };
}

/* MARKINGS *******************************************************************/

function scar(r, a, random, colour)
{
    for(let i = 0; i < 8; i++) { Pixels.dot(r, a, 3 + i * 0.5, 4 + i, colour); }
}

function weathered(r, a, random, colour)
{
    Pixels.rect(r, a, 4, 4, 3, 1, Pixels.shade(colour, 0.85));
    Pixels.rect(r, a, 9, 4, 3, 1, Pixels.shade(colour, 0.85));
    Pixels.dot(r, a, 2, 8, Pixels.shade(colour, 0.8));
    Pixels.dot(r, a, 13, 8, Pixels.shade(colour, 0.8));
}

function warpaint(r, a)
{
    Pixels.rect(r, a, 1, 7, 14, 1, "#1c1c1e");
    Pixels.rect(r, a, 1, 9, 2, 3, "#1c1c1e");
    Pixels.rect(r, a, 13, 9, 2, 3, "#1c1c1e");
}

function tattoo(r, a)
{
    for(const [x, y] of [[11, 3], [12, 4], [13, 5], [13, 6], [14, 8], [13, 10], [12, 11], [12, 12], [11, 13]]) { Pixels.dot(r, a, x, y, "#2a3448"); }
}

/* STAMPS *********************************************************************/

export const STAMPS =
{
    "eyes.1": { size: HEAD, seed: 40, paint: eyes(1) },
    "eyes.2": { size: HEAD, seed: 41, paint: eyes(2) },
    "lids": { size: HEAD, seed: 42, paint: lids },
    "hairline.full": { size: HEAD, seed: 43, paint: hairline(3) },
    "hairline.swept": { size: HEAD, seed: 48, paint: hairline(2) },
    "hairline.stubble": { size: HEAD, seed: 49, paint: stubbleLine },
    "hair.crest.top": { size: HEAD, seed: 70, paint: scalp("crest", "top") },
    "beard.stubble": { size: HEAD, seed: 71, paint: beard((x, y, random) => y >= 12 && random.next() < 0.3, false) },
    "beard.moustache": { size: HEAD, seed: 72, paint: beard((x, y) => y === 12 && x >= 5 && x <= 10) },
    "beard.full": { size: HEAD, seed: 73, paint: beard((x, y) => y >= 12 || x <= 3 || x >= 12) },
    "marking.scar": { size: HEAD, seed: 74, paint: scar },
    "marking.weathered": { size: HEAD, seed: 75, paint: weathered },
    "marking.warpaint": { size: HEAD, seed: 76, paint: warpaint },
    "marking.tattoo": { size: HEAD, seed: 77, paint: tattoo },
};

[["long", 44], ["shaved", 80], ["short", 84]].forEach(([style, seed]) =>
{
    const painted = style === "short" ? "crop" : style;

    SIDES.forEach((side, i) => { STAMPS["hair." + style + "." + side] = { size: HEAD, seed: seed + i, paint: scalp(painted, side) }; });
});

for(const [id, face] of Object.entries(FACES))
{
    STAMPS["face." + id + ".brows"] = { size: HEAD, seed: 100 + Number(id) * 3, paint: brows(face) };
    STAMPS["face." + id + ".skin"] = { size: HEAD, seed: 101 + Number(id) * 3, paint: skin(face) };
    STAMPS["face." + id + ".mouth"] = { size: HEAD, seed: 102 + Number(id) * 3, paint: mouth(face) };
}
