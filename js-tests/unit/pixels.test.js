import * as Face from "../../content/art/face.js";
import * as Pixels from "../../content/art/pixels.js";
import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Random } from "../../js/util/random.js";
import { Raster } from "../../js/engine/raster.js";

const PAINTERS = ["cloth", "leather", "chain", "plate", "planks", "timber", "plaster", "stone", "slate", "thatch", "bark", "needles", "grass", "mud", "cobble", "earth", "iron", "glow"];

describe("Pixels", () =>
{
    it("keeps every painter inside its area", () =>
    {
        for(const name of PAINTERS)
        {
            const raster = new Raster(24, 24);

            Pixels[name](raster, Pixels.area(4, 6, 10, 8), new Random(3), "#808080");

            for(let y = 0; y < 24; y++)
            {
                for(let x = 0; x < 24; x++)
                {
                    const isInside = x >= 4 && x < 14 && y >= 6 && y < 14;

                    if(!isInside) { assert.equal(raster.get(x, y)[3], 0, name + " painted outside its area at " + x + ", " + y); }
                }
            }
        }
    });

    it("paints the same texels for the same seed", () =>
    {
        const a = new Raster(16, 16);
        const b = new Raster(16, 16);

        Pixels.stone(a, Pixels.area(0, 0, 16, 16), new Random(9));
        Pixels.stone(b, Pixels.area(0, 0, 16, 16), new Random(9));

        assert.deepEqual(a.data, b.data);
    });

    it("cuts bands of rows from the top or the bottom", () =>
    {
        const target = Pixels.area(10, 20, 8, 30);

        assert.deepEqual(Pixels.rows(target, 0, 5), { x: 10, y: 20, w: 8, h: 5 });
        assert.deepEqual(Pixels.rows(target, -6, 6), { x: 10, y: 44, w: 8, h: 6 });
        assert.deepEqual(Pixels.rows(target, 25, 10), { x: 10, y: 45, w: 8, h: 5 });
    });
});

describe("Face", () =>
{
    it("leaves the top of a bald head as skin", () =>
    {
        const raster = new Raster(16, 16);

        Pixels.fill(raster, Pixels.area(0, 0, 16, 16), "#b49a84");
        Face.hair(raster, Pixels.area(0, 0, 16, 16), new Random(1), "top", "bald", "#000000");

        assert.deepEqual(raster.get(8, 8).slice(0, 3), [0xb4, 0x9a, 0x84]);
    });
});
