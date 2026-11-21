import * as Bake from "../../tools/bake/bake.js";
import * as ModelBaker from "../../tools/bake/models.js";
import * as TestAssets from "../helpers/assets.js";
import * as WorldTextureBaker from "../../tools/bake/world-textures.js";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, it } from "node:test";
import { MaterialLibrary } from "../../js/engine/materials.js";
import { WorldAtlas } from "../../js/engine/world-atlas.js";

const LOCK = path.resolve(import.meta.dirname, "..", "..", "assets.lock.json");

describe("Asset lock", () =>
{
    it("matches the baked assets; accept a deliberate change with npm run bake -- --accept", () =>
    {
        const lock = JSON.parse(fs.readFileSync(LOCK, "utf8"));
        const manifest = JSON.parse(fs.readFileSync(path.join(TestAssets.ASSETS, "manifest.json"), "utf8"));

        assert.deepEqual(Bake.compare(lock.files, manifest.files), []);
        assert.deepEqual(manifest.ids, lock.ids);
    });
});

describe("Bake", () =>
{
    it("refuses to drop a locked id unless a migration maps it to one that exists", () =>
    {
        const locked = { "world-texture": ["grass", "moss", "mud"] };
        const baked = { "world-texture": ["grass", "turf"] };

        assert.equal(Bake.checkIds(locked, baked, {}).length, 2);
        assert.deepEqual(Bake.checkIds(locked, baked, { "world-texture": { moss: "turf", mud: "grass" } }), []);
        assert.match(Bake.checkIds(locked, baked, { "world-texture": { moss: "turf", mud: "clay" } })[0], /"clay", which does not exist/);
    });

    it("lists added, changed and removed files against the lock", () =>
    {
        const changes = Bake.compare({ a: "1", b: "2", c: "3" }, { a: { sha256: "1" }, b: { sha256: "9" }, d: { sha256: "4" } });

        assert.deepEqual(changes.sort(), ["added d", "changed b", "removed c"]);
    });

    it("bakes the world textures and the models with no problems and the same bytes every time", async () =>
    {
        const problems = [];
        const first = [WorldTextureBaker.bake(problems), await ModelBaker.bake(problems)];
        const second = [WorldTextureBaker.bake(problems), await ModelBaker.bake(problems)];

        assert.deepEqual(problems, []);
        assert.deepEqual(first, second);
    });
});

describe("Model bake", () =>
{
    const RIG =
    {
        id: "pole",
        boxes: ["base", "top"],
        faceBone: "top",
        bones:
        [
            { name: "base", parent: "root", box: "base", pivot: [0, 0, 0], centre: [0, "base.h/2", 0] },
            { name: "top", parent: "base", box: "top", pivot: ["base.w/2 - 1", "base.h", 0], centre: [0, "top.h/2", 0], rest: [0, 0.2, 0.3] },
            { name: "topR", mirror: "top" },
        ],
        file: "rigs/pole.js",
    };

    const BODY =
    {
        id: "post",
        name: "Post",
        rig: "pole",
        order: 1,
        surface: "placeholder",
        boxes: { base: [4, 10, 4], top: [2, 2, 2] },
        variants: [{ id: "plain", name: "Plain", boxes: {} }],
        sliders: { build: { steps: 2, boxes: { base: [1, 0, 1] } } },
        measures: { radius: 0.2, walk: 1, run: 2, nameplate: 0.2, focus: 0.5 },
        skins: ["#404040"],
        file: "bodies/post.js",
    };

    function compiled(changes = {})
    {
        const problems = [];
        const rig = ModelBaker.compileRig({ ...RIG, ...changes }, problems);

        return { rig, problems };
    }

    it("compiles pivot sums into linear forms and mirrors bones across x", () =>
    {
        const { rig, problems } = compiled();
        const top = rig.bones.find((bone) => bone.name === "top");
        const mirror = rig.bones.find((bone) => bone.name === "topR");

        assert.deepEqual(problems, []);
        assert.deepEqual(top.pivot[0], { c: -1, t: [[0.5, "base", 0]] });
        assert.deepEqual(mirror.pivot[0], { c: 1, t: [[-0.5, "base", 0]] });
        assert.deepEqual(mirror.rest, [0, -0.2, -0.3]);
    });

    it("reports unknown boxes, unreadable sums, unknown parents and loops", () =>
    {
        const bones = (list) => compiled({ bones: list }).problems.join("\n");

        assert.match(bones([{ name: "base", parent: "root", box: "base", pivot: [0, "hand.h", 0], centre: [0, 0, 0] }]), /unknown box: hand/);
        assert.match(bones([{ name: "base", parent: "root", box: "base", pivot: [0, "base.h * * 2", 0], centre: [0, 0, 0] }]), /cannot read/);
        assert.match(bones([{ name: "base", parent: "neck", box: "base", pivot: [0, 0, 0], centre: [0, 0, 0] }]), /unknown bone: neck/);
        assert.match(bones([{ name: "a", parent: "b", pivot: [0, 0, 0] }, { name: "b", parent: "a", pivot: [0, 0, 0] }]), /its own ancestor/);
    });

    it("accepts a body that sizes every box and fits at every slider extreme", () =>
    {
        const { rig } = compiled();
        const problems = [];

        assert.ok(ModelBaker.checkBody(BODY, new Map([["pole", rig]]), problems));
        assert.deepEqual(problems, []);
    });

    it("reports a missing box, a variant that shrinks a box away, and bad measures", () =>
    {
        const rigs = new Map([["pole", compiled().rig]]);
        const report = (changes) =>
        {
            const problems = [];

            ModelBaker.checkBody({ ...BODY, ...changes }, rigs, problems);

            return problems.join("\n");
        };

        assert.match(report({ boxes: { base: [4, 10, 4] } }), /positive sizes for the top box/);
        assert.match(report({ variants: [{ id: "thin", name: "Thin", boxes: { base: [-3, 0, 0] } }] }), /makes the base box/);
        assert.match(report({ measures: { ...BODY.measures, run: 0.5 } }), /run faster than it walks/);
        assert.match(report({ rig: "tripod" }), /unknown rig: tripod/);
    });
});

describe("WorldAtlas", () =>
{
    const index = { size: 2, texelsPerMetre: 4, layers: [{ name: "grass", glow: false }, { name: "glow", glow: true }] };
    const image = { width: 2, height: 4, data: Uint8Array.from({ length: 32 }, (value, i) => i) };

    it("finds layers by name and rejects an unknown name", () =>
    {
        const atlas = new WorldAtlas(index, image);

        assert.equal(atlas.layer("glow"), 1);
        assert.deepEqual(atlas.glowLayers, [1]);
        assert.equal(atlas.uvPerMetre, 2);
        assert.throws(() => atlas.layer("velvet"), /Unknown world texture/);
    });

    it("flips the rows of each layer for upload and keeps the layer order", () =>
    {
        const atlas = new WorldAtlas(index, image);

        assert.deepEqual([...atlas.upload.subarray(0, 8)], [8, 9, 10, 11, 12, 13, 14, 15]);
        assert.deepEqual([...atlas.upload.subarray(16, 24)], [24, 25, 26, 27, 28, 29, 30, 31]);
    });

    it("rejects an image that does not hold every layer", () =>
    {
        assert.throws(() => new WorldAtlas(index, { ...image, height: 2 }), /not 2 by 4/);
    });

    it("makes only the glow layers emissive in the world material", () =>
    {
        assert.equal(MaterialLibrary.emissiveShader([]), "");
        assert.match(MaterialLibrary.emissiveShader([3, 21]), /abs\(vLayer - 3\.0\) < 0\.5 \|\| abs\(vLayer - 21\.0\) < 0\.5/);
    });
});
