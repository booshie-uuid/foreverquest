import * as Catalogue from "../../js/character/catalogue.js";
import * as Kit from "../../js/character/kit.js";
import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Appearance } from "../../js/character/appearance.js";

function dims(data)
{
    return Kit.dimensions(new Appearance(data));
}

function parts(data)
{
    const look = new Appearance(data);

    return Kit.partBlocks(look, Kit.dimensions(look));
}

describe("Kit.dimensions", () =>
{
    it("gives every race a 16-texel head", () =>
    {
        for(const race of Catalogue.RACES) { assert.deepEqual(dims({ race: race.id }).head, [16, 16, 16]); }
    });

    it("makes a human 1.8 metres tall with a head about a fifth and a half of that", () =>
    {
        const human = dims({ race: "human" });
        const ratio = Kit.height(human) / (human.head[1] * Kit.TEXEL);

        assert.ok(Math.abs(Kit.height(human) - 1.8) < 1e-9);
        assert.ok(ratio > 5.2 && ratio < 5.8, "The head is 1/" + ratio.toFixed(2));
    });

    it("splits the torso's width and depth between the legs", () =>
    {
        for(const race of Catalogue.RACES)
        {
            const size = dims({ race: race.id, body: "female", build: 1 });

            assert.equal(size.leg[0] * 2, size.torso[0]);
            assert.equal(size.leg[2], size.torso[2]);
        }
    });

    it("makes dwarves shorter and broader, and the female body narrower", () =>
    {
        const human = dims({ race: "human" });
        const dwarf = dims({ race: "dwarf" });

        assert.ok(Kit.height(dwarf) < Kit.height(human));
        assert.ok(dwarf.torso[0] > human.torso[0]);
        assert.ok(dims({ body: "female" }).torso[0] < human.torso[0]);
    });

    it("widens with build and scales with height", () =>
    {
        assert.ok(dims({ build: 1 }).torso[0] > dims({ build: -1 }).torso[0]);
        assert.ok(Kit.height(dims({ height: 1 })) > Kit.height(dims({ height: -1 })));
    });
});

describe("Kit.joints", () =>
{
    it("hangs the arms outside the torso and the legs under it", () =>
    {
        const size = dims({});
        const joints = Kit.joints(size);

        assert.equal(joints.armL.at[0], (size.torso[0] + size.arm[0]) / 2);
        assert.equal(joints.armR.at[0], -joints.armL.at[0]);
        assert.equal(joints.legL.at[1], size.leg[1]);
        assert.equal(joints.head.parent, "torso");
    });
});

describe("Kit.partBlocks", () =>
{
    it("adds tusks for orcs only", () =>
    {
        const tusks = (race) => parts({ race, equipment: { head: { item: "none" } } }).filter((block) => block.size.join() === "1,3,1").length;

        assert.equal(tusks("orc"), 2);
        assert.equal(tusks("human"), 0);
    });

    it("drops the hair blocks under headgear that hides the hair", () =>
    {
        const count = (head) => parts({ hair: "long", equipment: { head: { item: head } } }).filter((block) => block.joint === "head").length;

        assert.ok(count("none") > count("hood") - 2, "The hood should replace the long hair");
        assert.ok(count("kettle") > count("helm"));
    });

    it("attaches held items to the hands and coat tails to the legs", () =>
    {
        const blocks = parts({ equipment: { chest: { item: "coat" }, mainHand: { item: "sword" }, offHand: { item: "lantern" } } });
        const joints = new Set(blocks.map((block) => block.joint));

        assert.ok(joints.has("armR") && joints.has("armL") && joints.has("legL") && joints.has("legR"));
    });
});
