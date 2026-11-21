import * as TestAssets from "../helpers/assets.js";
import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Appearance } from "../../js/character/appearance.js";
import { Random } from "../../js/util/random.js";

const library = await TestAssets.library();

describe("Appearance.normalise", () =>
{
    it("fills every field and slot from an empty record", () =>
    {
        const look = new Appearance(library);

        assert.equal(look.get("body"), "human");
        assert.deepEqual(Object.keys(look.toJSON().equipment).sort(), library.rig("humanoid").gear.map((slot) => slot.id).sort());
    });

    it("replaces invalid values with defaults and keeps valid ones", () =>
    {
        const look = new Appearance(library, { body: "dragon", hair: "topknot", height: 5, equipment: { head: { item: "crown" }, chest: { item: "robe" } } });

        assert.equal(look.get("body"), "human");
        assert.equal(look.get("hair"), "topknot");
        assert.equal(look.get("height"), 0);
        assert.equal(look.equipped("head").item, "none");
        assert.equal(look.equipped("chest").item, "robe");
    });

    it("moves a skin tone from another body to the new body's palette", () =>
    {
        const look = new Appearance(library, { body: "orc", skin: "#f3d2b6" });

        assert.ok(library.body("orc").skins.includes(look.get("skin")));
    });

    it("migrates a version 1 record, which named the body race and the variant body", () =>
    {
        const look = new Appearance(library, { name: "Brom", race: "dwarf", body: "female", skin: "#8a6450", hair: "braids" });

        assert.equal(look.get("body"), "dwarf");
        assert.equal(look.get("variant"), "female");
        assert.equal(look.get("skin"), "#8a6450");
        assert.equal(look.get("hair"), "braids");
        assert.equal(look.toJSON().version, 2);
        assert.equal("race" in look.toJSON(), false);
    });

    it("keeps a creature body that is not playable, and picks a variant it has", () =>
    {
        const look = new Appearance(library, { body: "wolf", variant: "female" });

        assert.equal(look.get("body"), "wolf");
        assert.equal(look.get("variant"), "male");
        assert.ok(!look.choices("body").includes("wolf"));
    });
});

describe("Appearance changes", () =>
{
    it("rejects unknown fields and values outside the options", () =>
    {
        const look = new Appearance(library);

        assert.throws(() => look.set("tail", "long"), /Unknown appearance field/);
        assert.throws(() => look.set("hair", "afro"), /Invalid hair/);
        assert.throws(() => look.set("name", "x".repeat(30)), /Invalid name/);
        assert.throws(() => look.equip("head", "crown"), /Unknown item/);
        assert.throws(() => look.tint("chest", "primary", "#123456"), /Invalid primary colour/);
    });

    it("keeps the skin tone and variant valid when the body changes", () =>
    {
        const look = new Appearance(library, { body: "human", variant: "female", skin: "#f3d2b6" });

        look.set("body", "orc");

        assert.ok(look.body.skins.includes(look.get("skin")));
        assert.equal(look.get("variant"), "female");

        look.set("body", "ogre");

        assert.equal(look.get("variant"), "male");
    });

    it("emits one change per real change and none for a repeat", () =>
    {
        const look = new Appearance(library);
        const keys = [];

        look.onChange((source, key) => keys.push(key));
        look.set("hair", "long");
        look.set("hair", "long");
        look.equip("head", "hood");
        look.tint("head", "primary", library.palette("cloth")[0]);

        assert.deepEqual(keys, ["hair", "equipment", "equipment"]);
    });

    it("stops calling a listener after it unsubscribes", () =>
    {
        const look = new Appearance(library);
        let calls = 0;
        const unsubscribe = look.onChange(() => calls++);

        unsubscribe();
        look.set("hair", "long");

        assert.equal(calls, 0);
    });

    it("keeps a tint across items that share a palette and resets it across palettes", () =>
    {
        const look = new Appearance(library);
        const red = library.palette("cloth")[0];

        look.equip("chest", "tunic");
        look.tint("chest", "primary", red);
        look.equip("chest", "robe");

        assert.equal(look.equipped("chest").colour, red);

        look.equip("chest", "plate");

        assert.ok(library.palette("metal").includes(look.equipped("chest").colour));
    });
});

describe("Appearance serialisation", () =>
{
    it("survives a JSON round trip", () =>
    {
        const look = new Appearance(library, Appearance.randomData(library, new Random(3)));
        const copy = new Appearance(library, JSON.parse(JSON.stringify(look.toJSON())));

        assert.deepEqual(copy.toJSON(), look.toJSON());
    });

    it("returns copies, so callers cannot change the record directly", () =>
    {
        const look = new Appearance(library);

        look.toJSON().equipment.head.item = "helm";
        look.equipped("chest").item = "robe";

        assert.equal(look.equipped("head").item, "none");
        assert.equal(look.equipped("chest").item, "jerkin");
    });

    it("generates only valid records from random seeds", () =>
    {
        for(let seed = 1; seed <= 200; seed++)
        {
            const data = Appearance.randomData(library, new Random(seed));

            assert.deepEqual(new Appearance(library, data).toJSON(), data, "Seed " + seed + " produced an invalid record.");
        }
    });
});

describe("Appearance markings", () =>
{
    it("accepts the catalogue markings and rejects others", () =>
    {
        const look = new Appearance(library);

        look.set("markings", "warpaint");

        assert.equal(look.get("markings"), "warpaint");
        assert.throws(() => look.set("markings", "glitter"), /Invalid markings/);
        assert.equal(new Appearance(library, { markings: "glitter" }).get("markings"), "none");
    });
});
