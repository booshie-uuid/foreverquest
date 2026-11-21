import * as Pixels from "../../js/art/pixels.js";

const TILE = [48, 48];

// A stamp painter draws in the colour it is given wherever the texels take a
// part's tint; any other colour it draws is fixed.
export const STAMPS =
{
    "grit": { size: TILE, seed: 11, paint: (r, a, random, colour) => Pixels.grit(r, a, colour, random, 0.08) },
    "cloth": { size: TILE, seed: 12, paint: (r, a, random, colour) => Pixels.cloth(r, a, random, colour) },
    "leather": { size: TILE, seed: 13, paint: (r, a, random, colour) => Pixels.leather(r, a, random, colour) },
    "chain": { size: TILE, seed: 14, paint: (r, a, random, colour) => Pixels.chain(r, a, random, colour) },
    "plate": { size: TILE, seed: 15, paint: (r, a, random, colour) => Pixels.plate(r, a, random, colour) },
    "planks": { size: TILE, seed: 16, paint: (r, a, random, colour) => Pixels.planks(r, a, random, colour) },
    "iron": { size: TILE, seed: 17, paint: (r, a, random, colour) => Pixels.iron(r, a, random, colour) },
    "lamplight": { size: [8, 8], seed: 18, glow: true, paint: (r, a, random) => Pixels.glow(r, a, random) },
    "hem": { size: [48, 1], seed: 19, paint: (r, a, random, colour) => Pixels.fill(r, a, Pixels.shade(colour, 0.6)) },
    "ragged":
    {
        size: [48, 4],
        seed: 20,
        paint: (r, a, random) =>
        {
            for(let x = 0; x < a.w; x++)
            {
                const cut = Math.floor(random.next() * 4);

                for(let y = a.h - cut; y < a.h; y++) { Pixels.clear(r, a, x, y); }
            }
        },
    },
};
