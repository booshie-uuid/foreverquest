import * as Capture from "../reference/capture.js";
import * as TestAssets from "../helpers/assets.js";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, it } from "node:test";

const REFERENCE = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "..", "reference", "prototype.json"), "utf8"));
const materials = await TestAssets.materials();
const library = await TestAssets.library();
const hearthmere = await TestAssets.zone("hearthmere");

describe("Prototype reference", () =>
{
    // The reference meshes and sheets predate stamps, so only geometry is
    // compared.
    it("builds every reference character with the same joints, blocks, height and triangles", () =>
    {
        for(const { label, look, record } of REFERENCE.characters)
        {
            const current = Capture.characterRecord(library, look);

            assert.deepEqual(current.joints, record.joints, label);
            assert.deepEqual(current.bodyBlocks, record.bodyBlocks, label);
            assert.deepEqual(current.partBlocks, Capture.sorted(record.partBlocks), label);
            assert.deepEqual([current.scale, current.height, current.triangles], [record.scale, record.height, record.triangles], label);
        }
    });

    it("gives every option on every body the same part blocks", () =>
    {
        const sweep = Capture.partSweep(library);

        assert.deepEqual(Object.keys(sweep).sort(), Object.keys(REFERENCE.parts).sort());

        for(const [label, blocks] of Object.entries(REFERENCE.parts)) { assert.deepEqual(sweep[label], Capture.sorted(blocks), label); }
    });

    it("bakes the same world texture layers", () =>
    {
        assert.deepEqual(Capture.worldTexturesRecord(materials.atlas), REFERENCE.worldTextures);
    });

    // The zone file stores scales to six places, so a scaled radius can
    // differ from the reference in its sixth place.
    it("bakes Hearthmere with the same tiles, colliders and light spots", () =>
    {
        const actual = Capture.zoneRecord(hearthmere);
        const expected = REFERENCE.zone;
        const near = (a, b, label) => assert.ok(Math.abs(a - b) <= 1e-5, label + ": " + a + " is not " + b);

        assert.deepEqual([actual.size, actual.levels, actual.types], [expected.size, expected.levels, expected.types]);
        assert.equal(actual.colliders.length, expected.colliders.length);
        assert.equal(actual.lightSpots.length, expected.lightSpots.length);

        expected.colliders.forEach((collider, i) =>
        {
            assert.deepEqual(Object.keys(actual.colliders[i]).sort(), Object.keys(collider).sort(), "collider " + i);

            for(const [key, value] of Object.entries(collider)) { near(actual.colliders[i][key], value, "collider " + i + " " + key); }
        });

        expected.lightSpots.forEach((spot, i) => spot.forEach((value, axis) => near(actual.lightSpots[i][axis], value, "light " + i)));
    });
});
