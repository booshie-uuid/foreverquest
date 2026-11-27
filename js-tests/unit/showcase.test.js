import * as Blocks from "../../tools/bake/blocks.js";
import * as Catalogue from "../../tools/bake/catalogue.js";
import * as Objects from "../../tools/bake/objects.js";
import * as Props from "../../tools/bake/props.js";
import * as Showcase from "../../tools/bake/showcase.js";
import * as WorldTextures from "../../tools/bake/world-textures.js";
import * as Zones from "../../tools/bake/zones.js";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, it } from "node:test";

const FOLDER = path.resolve(import.meta.dirname, "..", "..", "content", "zones", "kitfield");
const context = {};

for(const baker of [WorldTextures, Blocks, Props, Objects, Catalogue]) { await baker.bake([], context); }

const SHOWCASE = { pack: "hearthmere", x: -14, z: -14 };

function named(props)
{
    return props.map((prop) => prop.prefab ?? prop.object);
}

describe("Showcase", () =>
{
    it("places a room, then a sample of each of the pack's blocks inside it and a sample wall outside, and each object in the room and in the open", () =>
    {
        const problems = [];
        const shown = Showcase.expand(SHOWCASE, context, "Zone", problems);
        const blocks = Object.keys(context.catalogue.blocks).filter((id) => context.catalogue.blocks[id].pack === "hearthmere");
        const pieces = Object.keys(context.catalogue.pieces).filter((id) => context.catalogue.pieces[id].pack === "hearthmere");
        const count = (name) => named(shown.props).filter((each) => each === name).length;

        assert.deepEqual(problems, []);
        assert.equal(shown.props[0].prefab, "showcase.room");
        assert.ok(blocks.length > 0 && pieces.length > 0, "The Hearthmere pack is empty");
        assert.deepEqual(blocks.filter((id) => count("showcase.small." + id) !== 1 || count("showcase." + id) !== 1), []);
        assert.deepEqual(pieces.filter((id) => count(id) !== 2), []);
        assert.equal(count("candelabra"), 4);
    });

    it("shows a piece once the catalogue puts it in the pack, without placing it by hand", () =>
    {
        const added = { ...context, catalogue: { ...context.catalogue, pieces: { ...context.catalogue.pieces, cart: { type: "storage", pack: "hearthmere" } } } };
        const shown = Showcase.expand(SHOWCASE, added, "Zone", []);

        assert.ok(named(shown.props).includes("cart"));
        assert.ok(!named(Showcase.expand(SHOWCASE, context, "Zone", []).props).includes("cart"));
    });

    it("reports an unknown pack", () =>
    {
        const problems = [];

        assert.deepEqual(Showcase.expand({ pack: "nowhere", x: 0, z: 0 }, context, "Zone", problems).props, []);
        assert.deepEqual(problems, ["Zone shows an unknown pack: nowhere"]);
    });

    it("bakes the Hearthmere Test Field with every object of the room inside its walls, under its roof", async () =>
    {
        const problems = [];
        const zone = JSON.parse(fs.readFileSync(path.join(FOLDER, "zone.json"), "utf8"));
        const baked = await Zones.bakeZone(zone, FOLDER, await Zones.loadPeople(), context, "Zone", problems);
        const room = baked.index.objects.find((entry) => entry.name === "showcase.room").box;
        const outside = Showcase.expand(zone.showcase, context, "Zone", []).props.findIndex((prop) => /^showcase\.(?!small\.|room$)/.test(prop.prefab ?? ""));
        const inRoom = baked.index.objects.filter((entry) => entry.object && entry.prop < outside);
        const isInside = (box) => box[0] > room[0] && box[2] > room[2] && box[3] < room[3] && box[5] < room[5] && box[4] < room[4];

        assert.deepEqual(problems, []);
        assert.ok(inRoom.length > 0);
        assert.deepEqual(inRoom.filter((entry) => !isInside(entry.box)).map((entry) => entry.object), []);
    });
});
