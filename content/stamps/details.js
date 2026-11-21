import * as Pixels from "../art/pixels.js";

const SLOT = "#0a0a0c";

function opening(width, height, side, top)
{
    return (r, a) =>
    {
        for(let y = top; y < height; y++)
        {
            for(let x = side; x < width - side; x++) { Pixels.clear(r, a, x, y); }
        }
    };
}

function straps(isLeft)
{
    return (r, a, random, colour) =>
    {
        for(let y = 0; y < a.h; y++)
        {
            const inset = 4 + Math.floor(y / 4);

            Pixels.dot(r, a, isLeft ? inset : a.w - 1 - inset, y, colour);
        }
    };
}

export const STAMPS =
{
    "visor.slots":
    {
        size: [19, 20],
        seed: 30,
        paint: (r, a) =>
        {
            Pixels.rect(r, a, 2, 7, a.w - 4, 2, SLOT);

            for(let y = 12; y < a.h - 2; y += 2)
            {
                Pixels.dot(r, a, 4, y, SLOT);
                Pixels.dot(r, a, a.w - 5, y, SLOT);
            }
        },
    },
    "visor.nasal": { size: [19, 20], seed: 31, paint: (r, a, random, colour) => Pixels.rect(r, a, Math.floor(a.w / 2) - 1, 7, 2, a.h - 7, colour) },
    "tabard":
    {
        size: [10, 48],
        seed: 32,
        paint: (r, a, random, colour) =>
        {
            const middle = Math.floor(a.w / 2);

            Pixels.cloth(r, a, random, colour);
            Pixels.rect(r, a, middle - 1, 4, 2, 13, Pixels.shade(colour, 2.6));
            Pixels.rect(r, a, middle - 4, 8, 8, 2, Pixels.shade(colour, 2.6));
        },
    },
    "cut.hood": { size: [20, 20], seed: 33, paint: opening(20, 20, 3, 4) },
    "cut.coif": { size: [18, 18], seed: 34, paint: opening(18, 18, 3, 3) },
    "neckline":
    {
        size: [6, 4],
        seed: 35,
        paint: (r, a, random, colour) =>
        {
            for(let y = 0; y < 4; y++) { Pixels.rect(r, a, y, y, 6 - y * 2, 1, colour); }
        },
    },
    "straps.left": { size: [16, 48], seed: 36, paint: straps(true) },
    "straps.right": { size: [16, 48], seed: 37, paint: straps(false) },
    "buttons.line": { size: [1, 48], seed: 38, paint: (r, a, random, colour) => Pixels.fill(r, a, Pixels.shade(colour, 0.35)) },
    "buttons.studs":
    {
        size: [5, 48],
        seed: 39,
        paint: (r, a, random, colour) =>
        {
            for(let y = 4; y < a.h; y += 4)
            {
                Pixels.dot(r, a, 0, y, colour);
                Pixels.dot(r, a, 4, y, colour);
            }
        },
    },
    "boss.field": { size: [12, 12], seed: 60, paint: (r, a, random, colour) => Pixels.rect(r, a, 2, 2, a.w - 4, a.h - 4, colour) },
    "heraldry.charge":
    {
        size: [18, 22],
        seed: 61,
        paint: (r, a, random, colour) =>
        {
            const middle = Math.floor(a.w / 2);

            Pixels.rect(r, a, middle - 1, 3, 2, a.h - 8, colour);
            Pixels.rect(r, a, 3, Math.floor(a.h * 0.35), a.w - 6, 2, colour);
        },
    },
    "heraldry.cut":
    {
        size: [18, 22],
        seed: 62,
        paint: (r, a) =>
        {
            for(let y = 0; y < a.h; y++)
            {
                const cut = Math.max(0, Math.floor(((y - a.h * 0.55) / (a.h * 0.45)) * (a.w / 2)));

                for(let x = 0; x < cut; x++)
                {
                    Pixels.clear(r, a, x, y);
                    Pixels.clear(r, a, a.w - 1 - x, y);
                }
            }
        },
    },
};
