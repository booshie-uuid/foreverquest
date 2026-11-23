import * as Capture from "../reference/capture.js";
import * as TestAssets from "../helpers/assets.js";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, it } from "node:test";

const REFERENCE = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "..", "reference", "prototype.json"), "utf8"));
const library = await TestAssets.library();

describe("Prototype reference", () =>
{
    // The reference meshes and sheets predate stamps, so only geometry is
    // compared. Blocks are in texels; joints and heights are in metres, which
    // grew with the texel and are rounded to six places.
    it("builds every reference character with the same joints, blocks, height and triangles", () =>
    {
        const near = (a, b, label) => assert.ok(Math.abs(a - b * Capture.GROWTH) <= 1e-5, label + ": " + a + " is not " + b + " grown");

        for(const { label, look, record } of REFERENCE.characters)
        {
            const current = Capture.characterRecord(library, look);

            assert.deepEqual(Object.keys(current.joints).sort(), Object.keys(record.joints).sort(), label);

            for(const [name, joint] of Object.entries(record.joints))
            {
                assert.equal(current.joints[name].parent, joint.parent, label + " " + name);
                joint.at.forEach((value, axis) => near(current.joints[name].at[axis], value, label + " " + name + " axis " + axis));
            }

            assert.deepEqual(current.bodyBlocks, record.bodyBlocks, label);
            assert.deepEqual(current.partBlocks, Capture.sorted(record.partBlocks), label);
            assert.deepEqual([current.scale, current.triangles], [record.scale, record.triangles], label);
            near(current.height, record.height, label + " height");
        }
    });

    it("gives every option on every body the same part blocks", () =>
    {
        const sweep = Capture.partSweep(library);

        assert.deepEqual(Object.keys(sweep).sort(), Object.keys(REFERENCE.parts).sort());

        for(const [label, blocks] of Object.entries(REFERENCE.parts)) { assert.deepEqual(sweep[label], Capture.sorted(blocks), label); }
    });
});
