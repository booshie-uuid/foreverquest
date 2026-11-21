import * as Fitter from "../../js/kit/fitter.js";
import * as Kit from "../../js/character/kit.js";
import * as TestAssets from "../helpers/assets.js";
import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Appearance } from "../../js/character/appearance.js";

const library = await TestAssets.library();

function parts(data)
{
    const look = new Appearance(library, data);
    const fitted = Fitter.fit(library.rig("humanoid"), look.body, { variant: look.get("variant"), height: look.get("height"), build: look.get("build") });

    return Kit.partBlocks(look, { ...fitted.boxes, scale: fitted.scale });
}

describe("Kit.partBlocks", () =>
{
    it("adds tusks for orcs only", () =>
    {
        const tusks = (body) => parts({ body, equipment: { head: { item: "none" } } }).filter((block) => block.size.join() === "1,3,1").length;

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
