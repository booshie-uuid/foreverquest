import * as Face from "../../js/art/face.js";
import * as Pixels from "../../js/art/pixels.js";

const HEAD = [16, 16];
const WHITE = "#c9c0ae";

// Face shapes by face id: brow raise, eye height, line depth and mouth shape.
const FACES =
{
    1: { brow: 0, eyes: 1, lines: 0, mouth: 0 },
};

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

function scalp(style, side)
{
    return (r, a, random, colour) => Face.hair(r, a, random, side, style, colour);
}

export const STAMPS =
{
    "eyes.1": { size: HEAD, seed: 40, paint: eyes(1) },
    "eyes.2": { size: HEAD, seed: 41, paint: eyes(2) },
    "lids": { size: HEAD, seed: 42, paint: lids },
    "hairline.full": { size: HEAD, seed: 43, paint: hairline(3) },
    "hair.long.top": { size: HEAD, seed: 44, paint: scalp("long", "top") },
    "hair.long.back": { size: HEAD, seed: 45, paint: scalp("long", "back") },
    "hair.long.left": { size: HEAD, seed: 46, paint: scalp("long", "left") },
    "hair.long.right": { size: HEAD, seed: 47, paint: scalp("long", "right") },
};

for(const [id, face] of Object.entries(FACES))
{
    STAMPS["face." + id + ".brows"] = { size: HEAD, seed: 50 + Number(id) * 3, paint: brows(face) };
    STAMPS["face." + id + ".skin"] = { size: HEAD, seed: 51 + Number(id) * 3, paint: skin(face) };
    STAMPS["face." + id + ".mouth"] = { size: HEAD, seed: 52 + Number(id) * 3, paint: mouth(face) };
}
