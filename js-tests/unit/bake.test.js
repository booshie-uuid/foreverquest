import * as Bake from "../../tools/bake/bake.js";
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

    it("bakes the world textures with no problems and the same bytes every time", () =>
    {
        const problems = [];
        const first = WorldTextureBaker.bake(problems);
        const second = WorldTextureBaker.bake(problems);

        assert.deepEqual(problems, []);
        assert.deepEqual(first, second);
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
