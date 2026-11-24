import * as Blocks from "../../tools/bake/blocks.js";
import * as TestAssets from "../helpers/assets.js";
import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BlockSet } from "../../js/sim/block-set.js";

const TEXTURES = ["grass", "earth", "water"];

function problemsOf(block)
{
    const problems = [];

    Blocks.bakeBlock("sample", block, TEXTURES, "Block sample", problems);

    return problems;
}

describe("Block bake", () =>
{
    it("fills the top, sides and bottom from all", () =>
    {
        const baked = Blocks.bakeBlock("sample", { faces: { all: "earth", top: "grass" } }, TEXTURES, "Block sample", []);

        assert.deepEqual(baked, { id: "sample", kind: "solid", light: 0, faces: { top: "grass", side: "earth", bottom: "earth" }, weathers: [] });
    });

    it("rejects unknown textures, faces and kinds, a missing face and a light out of range", () =>
    {
        assert.match(problemsOf({ faces: { all: "lava" } })[0], /unknown world texture: lava/);
        assert.match(problemsOf({ faces: { all: "earth", front: "grass" } })[0], /unknown face: front/);
        assert.match(problemsOf({ faces: { all: "earth" }, kind: "gas" })[0], /unknown kind: gas/);
        assert.match(problemsOf({ faces: { top: "grass" } })[0], /top, sides and bottom/);
        assert.match(problemsOf({ faces: { all: "earth" }, light: 16 })[0], /light from 0 to 15/);
        assert.deepEqual(problemsOf({ faces: { all: "water" }, kind: "liquid", light: 15 }), []);
    });

    it("keeps the ways a solid block weathers and the texture it wears to, and rejects others", () =>
    {
        const baked = Blocks.bakeBlock("sample", { faces: { all: "earth" }, weathers: ["moss", "chips"], worn: "grass" }, TEXTURES, "Block sample", []);

        assert.deepEqual([baked.weathers, baked.worn], [["moss", "chips"], "grass"]);
        assert.match(problemsOf({ faces: { all: "earth" }, weathers: ["rust"] })[0], /weathers in an unknown way/);
        assert.match(problemsOf({ faces: { all: "water" }, kind: "liquid", weathers: ["moss"] })[0], /or is not solid/);
        assert.match(problemsOf({ faces: { all: "earth" }, worn: "lava" })[0], /wears to an unknown world texture: lava/);
    });
});

describe("Block set", () =>
{
    it("puts glass textures on glass blocks only, and only glass textures on them", () =>
    {
        const glassProblems = (block) =>
        {
            const problems = [];

            Blocks.bakeBlock("sample", block, [...TEXTURES, "leadedGlass"], "Block sample", problems, ["leadedGlass"]);

            return problems;
        };

        assert.deepEqual(glassProblems({ faces: { all: "leadedGlass" }, kind: "glass" }), []);
        assert.equal(glassProblems({ faces: { all: "leadedGlass" } }).length, 1);
        assert.equal(glassProblems({ faces: { all: "earth", side: "leadedGlass" }, kind: "glass" }).length, 1);
    });

    it("numbers the baked blocks from 1, with 0 as air", async () =>
    {
        const blocks = await TestAssets.blocks();

        assert.equal(blocks.block(BlockSet.AIR), null);
        assert.equal(blocks.block(blocks.number("grass")).id, "grass");
        assert.equal(blocks.number(blocks.block(blocks.count).id), blocks.count);
        assert.throws(() => blocks.number("lava"), /Unknown block: lava/);
    });

    it("tells solid, see-through, liquid and glowing blocks apart", () =>
    {
        const blocks = new BlockSet(
        [
            { id: "stone", kind: "solid", light: 0, faces: {} },
            { id: "leaves", kind: "clear", light: 0, faces: {} },
            { id: "pane", kind: "glass", light: 0, faces: {} },
            { id: "water", kind: "liquid", light: 0, faces: {} },
            { id: "window", kind: "solid", light: 12, faces: {} },
        ]);
        const flags = (id) =>
        {
            const number = blocks.number(id);

            return [blocks.isSolid(number), blocks.isOpaque(number), blocks.isLiquid(number), blocks.light(number)];
        };

        assert.deepEqual(flags("stone"), [true, true, false, 0]);
        assert.deepEqual(flags("leaves"), [true, false, false, 0]);
        assert.deepEqual(flags("pane"), [true, false, false, 0]);
        assert.deepEqual(flags("water"), [false, false, true, 0]);
        assert.deepEqual(flags("window"), [true, true, false, 12]);
        assert.deepEqual([blocks.isSolid(BlockSet.AIR), blocks.isOpaque(BlockSet.AIR)], [false, false]);
    });
});
