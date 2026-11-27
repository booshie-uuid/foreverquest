import * as Blocks from "../../tools/bake/blocks.js";
import * as Catalogue from "../../tools/bake/catalogue.js";
import * as Objects from "../../tools/bake/objects.js";
import * as Props from "../../tools/bake/props.js";
import * as WorldTextures from "../../tools/bake/world-textures.js";
import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PaletteFilter } from "../../js/editor/palette-filter.js";

function source(extra = {})
{
    return {
        BLOCK_TYPES: { stone: { label: "Stone", ids: ["slab"] }, wood: { label: "Wood", ids: ["planks"] } },
        PIECE_TYPES: { furniture: { label: "Furniture", ids: ["stool"] }, plants: { label: "Plants", ids: ["pine"] } },
        PACKS: { core: { label: "Core" }, hearthmere: { label: "Hearthmere", blocks: ["planks"], pieces: ["stool"] } },
        ...extra,
    };
}

describe("catalogue", () =>
{
    it("gives every block, prefab and object in the content a type", async () =>
    {
        const problems = [];
        const context = {};

        for(const baker of [WorldTextures, Blocks, Props, Objects]) { await baker.bake(problems, context); }

        const baked = JSON.parse(Catalogue.bake(problems, context).files[0].bytes.toString());
        const untyped = [...Object.keys(context.prefabs), ...Object.keys(context.objects)].filter((id) => !baked.pieces[id]);

        assert.deepEqual(problems, []);
        assert.deepEqual(untyped, []);
        assert.equal(baked.pieces["pine.3"].type, "plants");
        assert.equal(baked.blocks.cobble.type, "ground");
    });

    it("puts each block and piece in the core pack unless another pack lists it, and gives a prefab variant the entry of its base", () =>
    {
        const problems = [];
        const baked = Catalogue.bakeCatalogue(source(), ["slab", "planks"], ["stool", "pine.0", "pine.1", "drawn"], problems);

        assert.deepEqual(problems, []);
        assert.deepEqual(baked.blocks, { slab: { type: "stone", pack: "core" }, planks: { type: "wood", pack: "hearthmere" } });
        assert.deepEqual(baked.pieces, { "pine.0": { type: "plants", pack: "core" }, "pine.1": { type: "plants", pack: "core" }, stool: { type: "furniture", pack: "hearthmere" } });
        assert.deepEqual(baked.packs, [["core", "Core"], ["hearthmere", "Hearthmere"]]);
    });

    it("reports an unknown id, an id under two types or two packs, a pack naming an untyped id, and a block with no type", () =>
    {
        const problems = [];
        const broken = source(
        {
            BLOCK_TYPES: { stone: { label: "Stone", ids: ["slab", "nothing"] }, wood: { label: "Wood", ids: ["slab"] } },
            PACKS: { core: { label: "Core" }, one: { label: "One", pieces: ["stool"] }, two: { label: "Two", pieces: ["stool", "pine"], blocks: ["planks"] } },
        });

        Catalogue.bakeCatalogue(broken, ["slab", "planks"], ["stool"], problems);

        assert.deepEqual(problems,
        [
            "The catalogue's stone type names an unknown block: nothing",
            "The catalogue lists the block slab under both stone and wood",
            "The catalogue's plants type names an unknown piece: pine",
            "Block planks needs a type in catalogue.js",
            "The catalogue's two pack names a block with no type: planks",
            "The catalogue lists the piece stool in both the one and two packs",
            "The catalogue's two pack names a piece with no type: pine",
        ]);
    });
});

describe("palette filter", () =>
{
    const entries = { slab: { type: "stone", pack: "core" }, planks: { type: "wood", pack: "hearthmere" } };
    const make = () => new PaletteFilter({ types: [["stone", "Stone"], ["wood", "Wood"]], packs: [["core", "Core"], ["hearthmere", "Hearthmere"]], entries, extras: [["recent", "Recent"]] });
    const shown = (filter) => ["slab", "planks", "drawn"].filter((id) => filter.matches(id));

    it("shows one type, one pack, or both, and an id with no entry as Other in the core pack", () =>
    {
        const filter = make();
        const seen = [shown(filter)];

        filter.set("type", "wood");
        seen.push(shown(filter));
        filter.set("type", "other");
        seen.push(shown(filter));
        filter.set("type", PaletteFilter.ALL);
        filter.set("pack", "core");
        seen.push(shown(filter));
        filter.set("type", "recent");
        filter.set("pack", "hearthmere");
        seen.push(shown(filter));

        assert.deepEqual(seen, [["slab", "planks", "drawn"], ["planks"], ["drawn"], ["slab", "drawn"], ["planks"]]);
    });

    it("offers Other only when an id has no entry, and calls back when a choice changes", () =>
    {
        const filter = make();
        let changes = 0;
        const typeChoices = (ids) => filter.fields(ids, () => changes++)[0].choices.map(([value]) => value);

        assert.deepEqual(typeChoices(["slab"]), ["all", "stone", "wood", "recent"]);
        assert.deepEqual(typeChoices(["slab", "drawn"]), ["all", "stone", "wood", "other", "recent"]);

        filter.fields(["slab"], () => changes++)[1].onChange("hearthmere");

        assert.equal(filter.pack, "hearthmere");
        assert.equal(changes, 1);
    });
});
