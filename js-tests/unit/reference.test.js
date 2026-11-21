import * as Capture from "../reference/capture.js";
import * as TestAssets from "../helpers/assets.js";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, it } from "node:test";

const REFERENCE = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "..", "reference", "prototype.json"), "utf8"));
const materials = await TestAssets.materials();
const library = await TestAssets.library();

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

    it("builds the same zone tiles, colliders, lights and meshes", () =>
    {
        assert.deepEqual(Capture.zoneRecord(materials), REFERENCE.zone);
    });
});
