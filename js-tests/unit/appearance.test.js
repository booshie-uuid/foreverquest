import * as Catalogue from "../../js/character/catalogue.js";
import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Appearance } from "../../js/character/appearance.js";
import { Random } from "../../js/util/random.js";

describe("Appearance.normalise", () =>
{
    it("fills every field and slot from an empty record", () =>
    {
        const look = new Appearance();

        assert.equal(look.get("race"), "human");
        assert.deepEqual(Object.keys(look.toJSON().equipment).sort(), Catalogue.SLOTS.map((slot) => slot.id).sort());
    });

    it("replaces invalid values with defaults and keeps valid ones", () =>
    {
        const look = new Appearance({ race: "dragon", hair: "topknot", height: 5, equipment: { head: { item: "crown" }, chest: { item: "robe" } } });

        assert.equal(look.get("race"), "human");
        assert.equal(look.get("hair"), "topknot");
        assert.equal(look.get("height"), 0);
        assert.equal(look.equipped("head").item, "none");
        assert.equal(look.equipped("chest").item, "robe");
    });

    it("moves a skin tone from another race to the new race's palette", () =>
    {
        const look = new Appearance({ race: "orc", skin: "#f3d2b6" });

        assert.ok(Catalogue.find(Catalogue.RACES, "orc").skins.includes(look.get("skin")));
    });
});

describe("Appearance changes", () =>
{
    it("rejects unknown fields and values outside the options", () =>
    {
        const look = new Appearance();

        assert.throws(() => look.set("tail", "long"), /Unknown appearance field/);
        assert.throws(() => look.set("hair", "afro"), /Invalid hair/);
        assert.throws(() => look.set("name", "x".repeat(30)), /Invalid name/);
        assert.throws(() => look.equip("head", "crown"), /Unknown item/);
        assert.throws(() => look.tint("chest", "primary", "#123456"), /Invalid primary colour/);
    });

    it("keeps the skin tone valid when the race changes", () =>
    {
        const look = new Appearance({ race: "human", skin: "#f3d2b6" });

        look.set("race", "orc");

        assert.ok(look.race.skins.includes(look.get("skin")));
    });

    it("emits one change per real change and none for a repeat", () =>
    {
        const look = new Appearance();
        const keys = [];

        look.onChange((source, key) => keys.push(key));
        look.set("hair", "long");
        look.set("hair", "long");
        look.equip("head", "hood");
        look.tint("head", "primary", Catalogue.CLOTH_COLOURS[0]);

        assert.deepEqual(keys, ["hair", "equipment", "equipment"]);
    });

    it("stops calling a listener after it unsubscribes", () =>
    {
        const look = new Appearance();
        let calls = 0;
        const unsubscribe = look.onChange(() => calls++);

        unsubscribe();
        look.set("hair", "long");

        assert.equal(calls, 0);
    });

    it("keeps a tint across items that share a palette and resets it across palettes", () =>
    {
        const look = new Appearance();
        const red = Catalogue.CLOTH_COLOURS[0];

        look.equip("chest", "tunic");
        look.tint("chest", "primary", red);
        look.equip("chest", "robe");

        assert.equal(look.equipped("chest").colour, red);

        look.equip("chest", "plate");

        assert.ok(Catalogue.METAL_COLOURS.includes(look.equipped("chest").colour));
    });
});

describe("Appearance serialisation", () =>
{
    it("survives a JSON round trip", () =>
    {
        const look = new Appearance(Appearance.randomData(new Random(3)));
        const copy = new Appearance(JSON.parse(JSON.stringify(look.toJSON())));

        assert.deepEqual(copy.toJSON(), look.toJSON());
    });

    it("returns copies, so callers cannot change the record directly", () =>
    {
        const look = new Appearance();

        look.toJSON().equipment.head.item = "helm";
        look.equipped("chest").item = "robe";

        assert.equal(look.equipped("head").item, "none");
        assert.equal(look.equipped("chest").item, "jerkin");
    });

    it("generates only valid records from random seeds", () =>
    {
        for(let seed = 1; seed <= 200; seed++)
        {
            const data = Appearance.randomData(new Random(seed));

            assert.deepEqual(Appearance.normalise(data), data, "Seed " + seed + " produced an invalid record.");
        }
    });
});

describe("Appearance markings", () =>
{
    it("accepts the catalogue markings and rejects others", () =>
    {
        const look = new Appearance();

        look.set("markings", "warpaint");

        assert.equal(look.get("markings"), "warpaint");
        assert.throws(() => look.set("markings", "glitter"), /Invalid markings/);
        assert.equal(new Appearance({ markings: "glitter" }).get("markings"), "none");
    });
});
