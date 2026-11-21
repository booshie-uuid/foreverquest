import * as Face from "../../js/art/face.js";
import * as Pixels from "../../js/art/pixels.js";
import * as WorldTextures from "../../js/world/world-textures.js";
import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Random } from "../../js/util/random.js";
import { Raster } from "../../js/engine/raster.js";

const PAINTERS = ["cloth", "leather", "chain", "plate", "planks", "timber", "plaster", "stone", "slate", "thatch", "bark", "needles", "grass", "mud", "cobble", "earth", "iron", "glow"];

const LOOK =
{
    skin: "#b49a84",
    hairColour: "#2b2119",
    eyes: "#3d4a3a",
    face: { brow: 0, eyes: 1, lines: 0, mouth: 0 },
    beard: "none",
    markings: "none",
    hair: "crop",
    isFemale: false,
};

function paintFace(changes)
{
    const raster = new Raster(16, 16);

    Face.front(raster, Pixels.area(0, 0, 16, 16), new Random(5), { ...LOOK, ...changes });

    return raster;
}

function differences(a, b)
{
    return a.data.filter((value, i) => value !== b.data[i]).length;
}

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
    it("paints the iris in the eye colour", () =>
    {
        const raster = paintFace({ eyes: "#6a2a2a" });

        assert.deepEqual(raster.get(4, 8).slice(0, 3), [0x6a, 0x2a, 0x2a]);
        assert.deepEqual(raster.get(11, 8).slice(0, 3), [0x6a, 0x2a, 0x2a]);
    });

    it("changes the face for each beard and marking", () =>
    {
        const plain = paintFace({});

        for(const beard of ["stubble", "moustache", "full"]) { assert.ok(differences(plain, paintFace({ beard })) > 8, beard); }
        for(const markings of ["scar", "weathered", "warpaint", "tattoo"]) { assert.ok(differences(plain, paintFace({ markings })) > 4, markings); }
    });

    it("leaves the top of a bald head as skin", () =>
    {
        const raster = new Raster(16, 16);

        Pixels.fill(raster, Pixels.area(0, 0, 16, 16), "#b49a84");
        Face.hair(raster, Pixels.area(0, 0, 16, 16), new Random(1), "top", "bald", "#000000");

        assert.deepEqual(raster.get(8, 8).slice(0, 3), [0xb4, 0x9a, 0x84]);
    });
});

describe("WorldTextures", () =>
{
    it("paints one opaque 32 by 32 layer per world texture", () =>
    {
        const data = WorldTextures.paintAll();

        assert.equal(data.length, WorldTextures.NAMES.length * WorldTextures.SIZE * WorldTextures.SIZE * 4);
        assert.ok(data.every((value, i) => i % 4 !== 3 || value === 255));
    });

    it("rejects an unknown texture name", () =>
    {
        assert.throws(() => WorldTextures.index("velvet"), /Unknown world texture/);
    });
});
