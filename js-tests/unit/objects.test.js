import * as FineMesher from "../../js/render/fine-mesher.js";
import * as Objects from "../../tools/bake/objects.js";
import * as THREE from "three";
import * as TestAssets from "../helpers/assets.js";
import * as Voxelise from "../../tools/bake/voxelise.js";
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
    const mesh = baked && FineMesher.mesh(FineMesher.decode(baked), (block) => BLOCKS.get(block).faces, 1);

    return { baked, mesh, problems };
}

describe("Fine-cube objects", () =>
{
    it("keeps every fine cube inside the object's cubes", () =>
    {
        const outside = bake({ cells: [1, 1, 1], build: (o) => o.box([0, 0, 0], [9, 1, 1], "planks") });
        const unknown = bake({ cells: [1, 1, 1], build: (o) => o.set(0, 0, 0, "lava") });
        const tooBig = bake({ cells: [9, 1, 1], build: () => {} });
        const lightOutside = bake({ cells: [1, 1, 1], lights: [[1, 0, 0]], build: (o) => o.set(0, 0, 0, "planks") });

        assert.match(outside.problems[0], /outside its cubes at 8, 0, 0/);
        assert.match(lightOutside.problems[0], /lights to be a list of its cells/);
        assert.match(unknown.problems[0], /unknown block: lava/);
        assert.match(tooBig.problems[0], /from 1 to 8/);
        assert.equal(outside.baked, null);
    });

    it("draws a lone fine cube as six faces an eighth of a cube across, with each side's texture", () =>
    {
        const { mesh } = bake({ cells: [1, 1, 1], build: (o) => o.set(3, 0, 3, "timber") });
        const xs = mesh.positions.filter((value, i) => i % 3 === 0);

        assert.equal(mesh.indices.length / 3, 12);
        assert.deepEqual([Math.min(...xs), Math.max(...xs)].map((value) => Math.round(value * 24)), [3, 4]);
        assert.deepEqual(mesh.textures.sort(), ["bark", "timber"]);
    });

    it("winds every triangle to face along its normal", () =>
    {
        const { mesh } = bake({ cells: [1, 1, 1], build: (o) =>
        {
            o.box([1, 1, 1], [5, 3, 4], "planks");
            o.set(6, 6, 6, "timber");
        } });
        const at = (index) => mesh.positions.slice(index * 3, index * 3 + 3);

        for(let t = 0; t < mesh.indices.length; t += 3)
        {
            const [a, b, c] = [0, 1, 2].map((k) => at(mesh.indices[t + k]));
            const ab = b.map((value, i) => value - a[i]);
            const ac = c.map((value, i) => value - a[i]);
            const cross = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
            const normal = mesh.normals.slice(mesh.indices[t] * 3, mesh.indices[t] * 3 + 3);

            assert.ok(cross[0] * normal[0] + cross[1] * normal[1] + cross[2] * normal[2] > 0, "Triangle " + t / 3 + " faces away from " + normal);
        }
    });

    it("merges the faces of one texture into rectangles", () =>
    {
        const { baked, mesh } = bake({ cells: [2, 1, 1], build: (o) => o.box([0, 0, 0], [16, 8, 8], "planks") });

        assert.equal(mesh.indices.length / 3, 12);
        assert.deepEqual(baked.cells, [2, 1, 1]);
        assert.equal(baked.isSolid, true);
    });

    it("stores the fine cubes as runs that decode to the same grid", () =>
    {
        const { baked } = bake({ cells: [1, 1, 1], build: (o) =>
        {
            o.box([0, 0, 0], [8, 1, 8], "planks");
            o.set(7, 7, 7, "timber");
        } });
        const { data, palette } = FineMesher.decode(baked);

        assert.equal(data.length, 512);
        assert.deepEqual([palette[data[0]], palette[data[63]], palette[data[64]], palette[data[511]]], ["planks", "planks", null, "timber"]);
        assert.equal(baked.runs.length, 6);
    });

    it("fails an object whose mesh goes over the triangle budget", () =>
    {
        const checker = bake({ cells: [8, 1, 8], build: (o) =>
        {
            for(let x = 0; x < 64; x++)
            {
                for(let z = 0; z < 64; z++) { if((x + z) % 2 === 0) { o.set(x, 0, z, "planks"); } }
            }
        } });

        assert.match(checker.problems[0], /triangles, more than 6000/);
    });
});

describe("Objects in a zone", () =>
{
    it("fills the cart's cells with the hidden object block and names them", async () =>
    {
        const zone = await TestAssets.zone("hearthmere");
        const cart = zone.objects.find((entry) => entry.object === "cart");
        const [x0, y0, z0, x1, y1, z1] = cart.box;
        const middle = [(x0 + x1) >> 1, y0 + 1, (z0 + z1) >> 1];

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
        const named = (kind) => meshes.find((mesh) => mesh.userData.entries[0].object === kind);

        view.update(0.016, new THREE.PerspectiveCamera(), { x: 0, y: 1, z: 0 });

        const regionOf = (entry) => zone.regionOfColumn(entry.box[0], entry.box[2]);
        const drawn = meshes.reduce((total, mesh) => total + mesh.count, 0);

        assert.ok(meshes.every((mesh) => mesh.userData.entries.every((entry) => entry.object === mesh.userData.entries[0].object && regionOf(entry) === regionOf(mesh.userData.entries[0]))), "A mesh mixes kinds or regions");
        assert.equal(drawn, zone.objects.filter((entry) => entry.object && view.objectGeometries.has(entry.object)).length);
        assert.equal(named("cart").geometry.getAttribute("light").getX(0), 1, "The cart under the open sky is not fully lit");
        view.dispose();
    });

    it("blocks the turned cells that the view draws fine cubes in, at every quarter turn", () =>
    {
        const { baked } = bake({ cells: [3, 1, 2], build: (o) => o.set(20, 3, 2, "planks") });
        const zone = { columns: 48, height: 8, base: 0 };
        const half = zone.columns / 6;

        for(let turns = 0; turns < 4; turns++)
        {
            const cells = new Map();
            const [entry] = Voxelise.placeObjects(cells, zone, [{ object: "sample", x: 0.2, z: -0.4, angle: turns * Math.PI / 2, index: 0 }], { sample: baked }, { object: 7 }, () => 0);
            const fine = new THREE.Vector3(20.5 / 24, 3.5 / 24, 2.5 / 24).applyMatrix4(ZoneView.objectMatrix(entry, [1, 1 / 3, 2 / 3]));
            const drawn = (Math.floor(fine.z * 3 + half * 3) * zone.columns) + Math.floor(fine.x * 3 + half * 3);

            assert.deepEqual([...cells.keys()], [drawn], "Turned " + turns + " times");
        }
    });

    it("stands an object on the floor under it, on top of what is there, or hangs it from the ceiling", async () =>
    {
        const zone = await TestAssets.zone("hearthmere");
        const placed = (name) => zone.objects.find((entry) => entry.name === "object " + name);
        const [altar, cross, chandelier] = ["altar", "cross", "chandelier"].map(placed);
        const [column, row] = zone.columnOf(cross.x - 0.1, cross.z - 0.1);
        const [middle, middleRow] = zone.columnOf(chandelier.x, chandelier.z);

        assert.ok(zone.isSolid(altar.box[0], altar.box[1] - 1, altar.box[2]) && !zone.isSolid(altar.box[0] - 1, altar.box[1], altar.box[2] + 2), "The altar is not on the chapel's floor");
        assert.equal(altar.y, placed("pew").y);
        assert.ok(zone.isSolid(column, cross.box[1] - 1, row), "The cross does not stand on the spire");
        assert.ok(!zone.isSolid(column, cross.box[4] + 1, row));
        assert.ok(zone.blocks.block(zone.blockAt(middle, chandelier.box[4] + 1, middleRow)).kind === "solid", "The chandelier does not hang from the ceiling");
        assert.ok(chandelier.y - altar.y >= 2, "The chandelier hangs lower than 2 metres");
    });

    it("lights an object from the floor below its top, and an object with lights at least as brightly as beside them", async () =>
    {
        const zone = await TestAssets.zone("hearthmere");
        const view = new ZoneView(zone, await TestAssets.materials(), null, await TestAssets.objects());
        const placed = (name) => zone.objects.find((entry) => entry.name === "object " + name);

        view.update(0.016, new THREE.PerspectiveCamera(), { x: 0, y: 1, z: 0 });

        assert.ok(view.objectLight(placed("runner")).lamp > 0, "The aisle's runner is unlit");
        assert.ok(view.objectLight(placed("pew")).lamp > 0);
        assert.equal(view.objectLight(placed("chandelier")).lamp, 13);
        assert.equal(view.objectLight(placed("altar")).lamp, 13);
        view.dispose();
    });

    it("lets a lamp post light the street under its lantern, and blocks only the cells it fills", async () =>
    {
        const zone = await TestAssets.zone("hearthmere");
        const view = new ZoneView(zone, await TestAssets.materials());
        const post = zone.objects.find((entry) => entry.object === "lampPost");
        const [column, row] = Voxelise.turnedCell([2, 6, 0], [3, 8, 1], post.turns).map((value, i) => value + post.box[i * 2]);
        const [poleColumn, poleRow] = Voxelise.turnedCell([0, 0, 0], [3, 8, 1], post.turns).map((value, i) => value + post.box[i * 2]);
        const half = zone.columns / 6;
        const under = view.lightAt({ x: (column + 0.5) / 3 - half, y: post.y, z: (row + 0.5) / 3 - half });

        assert.equal(zone.blocks.block(zone.blockAt(column, post.box[1] + 6, row)).id, "objectLight");
        assert.ok(zone.isSolid(poleColumn, post.box[1] + 3, poleRow), "The lamp post's pole does not block");
        assert.ok(!zone.isSolid(column, post.box[1], row), "The cell under the lantern blocks");
        assert.ok(under.lamp >= 5, "The lantern does not light the street: " + JSON.stringify(under));
        view.dispose();
    });
    it("stands an object's halos at the middle of each of its flames", async () =>
    {
        const objects = await TestAssets.objects();
        const blocks = await TestAssets.blocks();
        const flames = (id) => ZoneView.flamesOf(FineMesher.decode(objects[id]), blocks);
        const [lantern] = flames("lampPost");

        assert.deepEqual(lantern.at.map((value) => Math.round(value * 24 * 1000) / 1000), [17, 49, 4]);
        assert.equal(lantern.level, blocks.light(blocks.number("window")));
        assert.equal(flames("chandelier").length, 8, "The chandelier does not have a halo for each of its eight candles");
    });
});
