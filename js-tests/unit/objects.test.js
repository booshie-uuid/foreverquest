import * as Objects from "../../tools/bake/objects.js";
import * as TestAssets from "../helpers/assets.js";
import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ZoneView } from "../../js/render/zone-view.js";

const BLOCKS = new Map(
[
    ["planks", { id: "planks", kind: "solid", faces: { top: "planks", side: "planks", bottom: "planks" } }],
    ["timber", { id: "timber", kind: "solid", faces: { top: "timber", side: "bark", bottom: "timber" } }],
    ["object", { id: "object", kind: "object", faces: {} }],
]);

function bake(object)
{
    const problems = [];
    const baked = Objects.bakeObject("sample", object, BLOCKS, "Object sample", problems);

    return { baked, problems };
}

describe("Fine-cube objects", () =>
{
    it("keeps every fine cube inside the object's cubes", () =>
    {
        const outside = bake({ cells: [1, 1, 1], build: (o) => o.box([0, 0, 0], [9, 1, 1], "planks") });
        const unknown = bake({ cells: [1, 1, 1], build: (o) => o.set(0, 0, 0, "lava") });
        const tooBig = bake({ cells: [9, 1, 1], build: () => {} });

        assert.match(outside.problems[0], /outside its cubes at 8, 0, 0/);
        assert.match(unknown.problems[0], /unknown block: lava/);
        assert.match(tooBig.problems[0], /from 1 to 8/);
        assert.equal(outside.baked, null);
    });

    it("draws a lone fine cube as six faces an eighth of a cube across, with each side's texture", () =>
    {
        const { baked } = bake({ cells: [1, 1, 1], build: (o) => o.set(3, 0, 3, "timber") });
        const xs = baked.positions.filter((value, i) => i % 3 === 0);

        assert.equal(baked.indices.length / 3, 12);
        assert.deepEqual([Math.min(...xs), Math.max(...xs)].map((value) => Math.round(value * 24)), [3, 4]);
        assert.deepEqual(baked.textures.sort(), ["bark", "timber"]);
    });

    it("winds every triangle to face along its normal", () =>
    {
        const { baked } = bake({ cells: [1, 1, 1], build: (o) =>
        {
            o.box([1, 1, 1], [5, 3, 4], "planks");
            o.set(6, 6, 6, "timber");
        } });
        const at = (index) => baked.positions.slice(index * 3, index * 3 + 3);

        for(let t = 0; t < baked.indices.length; t += 3)
        {
            const [a, b, c] = [0, 1, 2].map((k) => at(baked.indices[t + k]));
            const ab = b.map((value, i) => value - a[i]);
            const ac = c.map((value, i) => value - a[i]);
            const cross = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
            const normal = baked.normals.slice(baked.indices[t] * 3, baked.indices[t] * 3 + 3);

            assert.ok(cross[0] * normal[0] + cross[1] * normal[1] + cross[2] * normal[2] > 0, "Triangle " + t / 3 + " faces away from " + normal);
        }
    });

    it("merges the faces of one texture into rectangles", () =>
    {
        const { baked } = bake({ cells: [2, 1, 1], build: (o) => o.box([0, 0, 0], [16, 8, 8], "planks") });

        assert.equal(baked.indices.length / 3, 12);
        assert.deepEqual(baked.cells, [2, 1, 1]);
        assert.equal(baked.isSolid, true);
    });
});

describe("Objects in a zone", () =>
{
    it("fills the cart's cells with the hidden object block and names them", async () =>
    {
        const zone = await TestAssets.zone("hearthmere");
        const cart = zone.objects.find((entry) => entry.object === "cart");
        const [x0, y0, z0, x1, y1, z1] = cart.box;
        const middle = [(x0 + x1) >> 1, y0, (z0 + z1) >> 1];

        assert.deepEqual([x1 - x0 + 1, y1 - y0 + 1, z1 - z0 + 1], [7, 3, 4]);
        assert.equal(zone.blocks.block(zone.blockAt(...middle)).id, "object");
        assert.ok(zone.isSolid(...middle));
        assert.equal(zone.objectAt(...middle).name, "object cart");
        assert.equal(zone.footingAt(cart.x, cart.z, cart.y, 0.35), null, "The cart lets an entity stand inside it");
    });

    it("draws each kind of object in a region as one instanced mesh, lit by the cell above it", async () =>
    {
        const zone = await TestAssets.zone("hearthmere");
        const view = new ZoneView(zone, await TestAssets.materials(), null, await TestAssets.objects());
        const meshes = [...view.objectMeshes.values()];

        view.update(0.016, { position: view.sky.position.clone() }, { x: 0, y: 1, z: 0 });

        assert.equal(meshes.length, 1);
        assert.equal(meshes[0].count, 1);
        assert.equal(meshes[0].geometry.getAttribute("light").getX(0), 1, "The cart under the open sky is not fully lit");
        view.dispose();
    });
});
