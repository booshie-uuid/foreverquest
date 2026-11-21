import * as Capture from "../reference/capture.js";
import * as Catalogue from "../../js/character/catalogue.js";
import * as Compositor from "../../js/kit/compositor.js";
import * as Dresser from "../../js/kit/dresser.js";
import * as Fitter from "../../js/kit/fitter.js";
import * as Kit from "../../js/character/kit.js";
import * as TestAssets from "../helpers/assets.js";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, it } from "node:test";
import { Appearance } from "../../js/character/appearance.js";
import { CharacterModel } from "../../js/character/character-model.js";
import { Random } from "../../js/util/random.js";
import { Raster } from "../../js/engine/raster.js";

const library = await TestAssets.library();
const REFERENCE = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "..", "reference", "prototype.json"), "utf8"));
const LOOK_SLOTS = ["hair", "face", "beard", "markings"];
const BARE = Object.fromEntries(Catalogue.SLOTS.map((slot) => [slot.id, { item: "none" }]));

// A 4 by 2 stamp: a tinted row at shade 1.5 over a fixed, a glowing, a clear
// and a skipped texel.
const STAMPS =
{
    rect: () => [0, 0, 4, 2],
    texel: (x, y) => (y === 0 ? [144, 0, 0, Compositor.TINTED] : [[10, 20, 30, Compositor.FIXED], [200, 150, 50, Compositor.GLOWING], [0, 0, 0, Compositor.CLEAR], [0, 0, 0, Compositor.SKIP]][x]),
};

function canvas()
{
    const raster = new Raster(8, 4);

    for(let i = 0; i < raster.data.length; i++) { raster.data[i] = 9; }

    return raster;
}

function sorted(blocks)
{
    return blocks.map(Capture.blockRecord).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

describe("Compositor", () =>
{
    it("crops rows from the top, or from the bottom when negative", () =>
    {
        const area = { x: 2, y: 10, w: 8, h: 32 };

        assert.deepEqual(Compositor.rows(area, [0, -5]), { x: 2, y: 10, w: 8, h: 27 });
        assert.deepEqual(Compositor.rows(area, [-5]), { x: 2, y: 37, w: 8, h: 5 });
        assert.deepEqual(Compositor.rows(area, [-6, -4]), { x: 2, y: 36, w: 8, h: 2 });
        assert.equal(Compositor.rows(area, null), area);
    });

    it("resolves a channel, a fixed colour, a shade and a mix", () =>
    {
        const colours = { skin: "#808080", primary: "#204060" };

        assert.deepEqual(Compositor.resolve({ of: "primary" }, colours), [0x20, 0x40, 0x60, 255]);
        assert.deepEqual(Compositor.resolve({ colour: "#102030" }, colours), [0x10, 0x20, 0x30, 255]);
        assert.deepEqual(Compositor.resolve({ of: "skin", shade: 0.5 }, colours), [64, 64, 64, 255]);
        assert.deepEqual(Compositor.resolve({ of: "skin", mix: "#000000", amount: 0.25 }, colours), [96, 96, 96, 255]);
        assert.equal(Compositor.resolve({ of: "trim" }, colours), null);
    });

    it("shades tinted texels, writes fixed and glowing ones, clears cut-outs and skips the rest", () =>
    {
        const raster = canvas();
        const glow = new Raster(8, 4);

        Compositor.draw(STAMPS, { stamp: "test", place: ["centre", "centre"], rows: null }, [100, 40, 20, 255], raster, glow, { x: 0, y: 0, w: 8, h: 4 }, new Random(1));

        assert.deepEqual(raster.get(2, 1), [150, 60, 30, 255]);
        assert.deepEqual(raster.get(2, 2), [10, 20, 30, 255]);
        assert.deepEqual(raster.get(3, 2), [200, 150, 50, 255]);
        assert.deepEqual(glow.get(3, 2), [200, 150, 50, 255]);
        assert.deepEqual(raster.get(4, 2), [0, 0, 0, 0]);
        assert.deepEqual(raster.get(5, 2), [9, 9, 9, 9]);
        assert.deepEqual(raster.get(0, 0), [9, 9, 9, 9]);
    });

    it("tiles a stamp across an area and aligns one to the bottom", () =>
    {
        const tiled = canvas();
        const bottom = canvas();
        const area = { x: 0, y: 0, w: 8, h: 4 };

        Compositor.draw(STAMPS, { stamp: "test", place: ["tile", "tile"], rows: null }, [100, 40, 20, 255], tiled, tiled, area, new Random(1));
        Compositor.draw(STAMPS, { stamp: "test", place: ["tile", "bottom"], rows: null }, [100, 40, 20, 255], bottom, bottom, area, new Random(1));

        assert.equal(tiled.data.filter((value, i) => i % 4 === 3 && value === 9).length, 4, "One texel in four is skipped");
        assert.deepEqual(bottom.get(0, 0), [9, 9, 9, 9]);
        assert.notDeepEqual(bottom.get(0, 3), [9, 9, 9, 9]);
    });
});

describe("Dresser", () =>
{
    it("places every baked part's blocks where the prototype placed them, on every body and variant", () =>
    {
        let checked = 0;

        for(const body of library.playableBodies)
        {
            for(const variant of body.variants)
            {
                for(const part of library.parts.values())
                {
                    const key = body.id + " " + variant.id + " " + part.slot + "=" + part.id;

                    if(!REFERENCE.parts[key]) { continue; }

                    const look = { body: body.id, variant: variant.id, hair: "bald", beard: "none", equipment: { ...BARE } };

                    if(LOOK_SLOTS.includes(part.slot)) { look[part.slot] = part.id; }
                    else { look.equipment[part.slot] = { item: part.id }; }

                    const appearance = new Appearance(library, look);
                    const fitted = Fitter.fit(library.rig(body.rig), appearance.body, { variant: variant.id });
                    const blocks = [...Kit.featureBlocks(appearance), ...Dresser.dress(fitted, appearance, library).blocks];

                    assert.deepEqual(sorted(blocks), [...REFERENCE.parts[key]].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))), key);
                    checked++;
                }
            }
        }

        assert.ok(checked >= 80, checked + " cases");
    });

    it("leaves out hair blocks under a helm that hides the hair", () =>
    {
        const look = new Appearance(library, { hair: "long", equipment: { head: { item: "helm" } } });
        const fitted = Fitter.fit(library.rig("humanoid"), look.body, { variant: "male" });
        const joints = Dresser.dress(fitted, look, library).blocks.map((block) => block.size.join());

        assert.ok(!joints.includes("18,18,3"), "The long hair's back block is still there");
    });

    it("builds a sound model from parts for every playable body and variant", () =>
    {
        for(const body of library.playableBodies)
        {
            for(const variant of body.variants)
            {
                const look = { body: body.id, variant: variant.id, face: "1", hair: "long", beard: "none", markings: "none", equipment: { head: { item: "helm" }, chest: { item: "plate" }, back: { item: "cloak" }, mainHand: { item: "sword" }, offHand: { item: "lantern" } } };
                const model = new CharacterModel(new Appearance(library, look), { pipeline: "parts" });

                for(const mesh of model.meshes)
                {
                    const uvs = mesh.geometry.getAttribute("uv").array;

                    assert.ok(mesh.geometry.getAttribute("position").array.every(Number.isFinite), body.id + " " + variant.id);
                    assert.ok(uvs.every((value) => value >= 0 && value <= 1), body.id + " " + variant.id);
                }

                assert.ok(model.textures.glow.image.data.some((value) => value > 0), "The lantern does not glow");
                model.dispose();
            }
        }
    });
});
