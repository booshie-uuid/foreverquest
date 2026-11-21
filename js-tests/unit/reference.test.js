import * as Capture from "../reference/capture.js";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, it } from "node:test";

const REFERENCE = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "..", "reference", "prototype.json"), "utf8"));

describe("Prototype reference", () =>
{
    it("builds every reference character with the same joints, blocks, meshes and texels", () =>
    {
        for(const { label, look, record } of REFERENCE.characters) { assert.deepEqual(Capture.characterRecord(look), record, label); }
    });

    it("gives every option on every body the same part blocks", () =>
    {
        const sweep = Capture.partSweep();

        assert.deepEqual(Object.keys(sweep).sort(), Object.keys(REFERENCE.parts).sort());

        for(const [label, blocks] of Object.entries(REFERENCE.parts)) { assert.deepEqual(sweep[label], blocks, label); }
    });

    it("paints the same world texture layers", () =>
    {
        assert.deepEqual(Capture.worldTexturesRecord(), REFERENCE.worldTextures);
    });

    it("builds the same zone tiles, colliders, lights and meshes", () =>
    {
        assert.deepEqual(Capture.zoneRecord(), REFERENCE.zone);
    });
});
