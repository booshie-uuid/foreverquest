import * as Pixels from "../../js/art/pixels.js";

const SLOT = "#0a0a0c";

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
};
