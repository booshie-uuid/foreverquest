import * as RegionCodec from "../../js/sim/region-codec.js";
import * as Terrain from "../../tools/bake/terrain.js";
import * as TestAssets from "../helpers/assets.js";
import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BlockSet } from "../../js/sim/block-set.js";
import { Random } from "../../js/util/random.js";
import { ZoneData } from "../../js/sim/zone-data.js";
import { ZoneView } from "../../js/render/zone-view.js";

const hearthmere = await TestAssets.zone("hearthmere");
const testfield = await TestAssets.zone("testfield");
const materials = await TestAssets.materials();
const prefabs = await TestAssets.prefabs();

// The prototype's collision: every collider, twice over, in the zone's order.
function fullScan(zone, from, to, radius)
{
    const result = { x: to.x, z: to.z };

    for(let pass = 0; pass < 2; pass++)
    {
        for(const collider of zone.colliders)
        {
            if(collider.radius !== undefined) { ZoneData.pushOutOfCircle(result, collider, radius); }
            else { ZoneData.pushOutOfBox(result, collider, radius); }
        }
    }

    return zone.canStep(from, result) ? result : { x: from.x, z: from.z };
}

describe("Zone cells", () =>
{
    it("rises and falls in whole cubes, with each column solid up to its surface", () =>
    {
        const blocks = hearthmere.blocks;

        for(let i = 0; i < 400; i++)
        {
            const [x, z] = [-47 + (i % 20) * 4.7, -47 + Math.floor(i / 20) * 4.7];
            const [column, row] = hearthmere.columnOf(x, z);
            const surface = hearthmere.surface(column, row);
            const height = hearthmere.heightAt(x, z);

            assert.ok(Math.abs(height * 3 - Math.round(height * 3)) < 1e-9, "Height " + height);
            assert.ok(hearthmere.isSolid(column, surface - 1, row) && hearthmere.isSolid(column, 0, row), x + ", " + z);
            assert.equal(blocks.isSolid(hearthmere.blockAt(column, surface, row)), false, x + ", " + z);
        }
    });

    it("keeps the village square flat and dry and floods the lake", () =>
    {
        for(const [x, z] of [[0, 0], [5, 3], [-4, -5], [10, 2]]) { assert.equal(hearthmere.heightAt(x, z), 2 / 3, x + ", " + z); }

        assert.equal(hearthmere.typeAt(0, 0), "cobble");
        assert.equal(hearthmere.isWater(0, 0), false);
        assert.ok(hearthmere.isWater(22, 16));
        assert.equal(hearthmere.blockAt(-1, 20, 0), BlockSet.AIR);
    });
});

describe("Region files", () =>
{
    it("keep uniform chunks as one block, leave air out and keep dense chunks whole", () =>
    {
        const dense = new Uint8Array(RegionCodec.CELLS).map((value, i) => i % 7);
        const region =
        {
            width: 40,
            depth: 32,
            height: 64,
            surfaces: Uint16Array.from({ length: 40 * 32 }, (value, i) => i % 65),
            chunks:
            [
                { x: 0, y: 0, z: 0, cells: new Uint8Array(RegionCodec.CELLS).fill(3) },
                { x: 1, y: 0, z: 0, cells: dense },
                { x: 0, y: 1, z: 0, cells: new Uint8Array(RegionCodec.CELLS) },
            ],
        };
        const decoded = RegionCodec.decode(RegionCodec.encode(region));

        assert.deepEqual([decoded.width, decoded.depth, decoded.height], [40, 32, 64]);
        assert.deepEqual(decoded.surfaces, region.surfaces);
        assert.deepEqual(decoded.chunks.map((chunk) => [chunk.x, chunk.y, chunk.z, chunk.uniform]), [[0, 0, 0, 3], [1, 0, 0, null]]);
        assert.deepEqual(decoded.chunks[1].cells, dense);
    });

    it("tops each column with its ground, then subsoil, then rock, and fills water to the water line", () =>
    {
        const zone = { columns: 32, height: 32, base: 4, water: 6 };
        const surfaces = new Uint16Array(32 * 32).fill(10);
        const grounds = new Uint8Array(32 * 32);

        surfaces[0] = 3;
        surfaces[5] = 20;

        const region = Terrain.composeRegion(zone, { surfaces, grounds }, [{ top: 1, under: 2 }], { rock: 9, water: 8 }, 0, 0);
        const cell = (x, y, z) => region.chunks[0].cells[(y * 32 + z) * 32 + x];

        assert.deepEqual([10, 9, 8, 7, 6, 5].map((y) => cell(10, y, 10)), [0, 1, 2, 2, 2, 9]);
        assert.deepEqual([2, 3, 4, 5, 6].map((y) => cell(0, y, 0)), [1, 8, 8, 8, 0]);
        assert.deepEqual([9, 8].map((y) => cell(1, y, 0)), [1, 9], "The face of a drop of more than four cubes is rock");
        assert.deepEqual([19, 18].map((y) => cell(5, y, 0)), [1, 9], "High ground is rock under its top");
        assert.equal(region.surfaces[5], 20);
    });
});

describe("Zone collision", () =>
{
    it("pushes a circle out of a rotated box", () =>
    {
        const point = { x: 0.2, z: 1.5 };

        ZoneData.pushOutOfBox(point, { x: 0, z: 0, halfWidth: 2, halfDepth: 1, angle: Math.PI / 2 }, 0.5);

        assert.ok(Math.abs(point.z) >= 2.5 - 1e-9 || Math.abs(point.x) >= 1.5 - 1e-9, JSON.stringify(point));
    });

    it("stops a step into the well, into the lake, and up more than half a metre", () =>
    {
        const intoWell = hearthmere.resolveStep({ x: 0, z: 2 }, { x: 0, z: 0.5 }, 0.35);

        assert.ok(Math.hypot(intoWell.x, intoWell.z) >= 1.2 + 0.35 - 1e-6);
        assert.deepEqual(hearthmere.resolveStep({ x: 21, z: 16 }, { x: 22, z: 16 }, 0.35), { x: 21, z: 16 });

        for(let x = -40; x < 40; x++)
        {
            for(let z = -40; z < 40; z++)
            {
                const step = hearthmere.heightAt(x + 1.5, z + 0.5) - hearthmere.heightAt(x + 0.5, z + 0.5);

                if(step > 0.5 && hearthmere.isWalkable(x + 1.5, z + 0.5))
                {
                    assert.equal(hearthmere.canStep({ x: x + 0.5, z: z + 0.5 }, { x: x + 1.5, z: z + 0.5 }), false);

                    return;
                }
            }
        }

        assert.fail("The zone has no step taller than half a metre to test");
    });

    it("resolves every step as a scan of every collider would, deep inside props included", () =>
    {
        const random = new Random(11);

        for(let i = 0; i < 3000; i++)
        {
            const from = { x: random.range(-44, 44), z: random.range(-44, 44) };
            const isLong = i % 3 === 0;
            const to = isLong ? { x: random.range(-44, 44), z: random.range(-44, 44) } : { x: from.x + random.range(-0.2, 0.2), z: from.z + random.range(-0.2, 0.2) };

            assert.deepEqual(hearthmere.resolveStep(from, to, 0.35), fullScan(hearthmere, from, to, 0.35), JSON.stringify({ from, to }));
        }
    });
});

describe("Zone placement", () =>
{
    it("turns, scales and lifts a prefab's colliders and lights onto the ground", () =>
    {
        const pine = testfield.placements.find((placement) => placement.prefab === "pine.0");
        const collider = testfield.colliders.find((entry) => entry.x === -8 && entry.z === -8);
        const lamp = testfield.placements.find((placement) => placement.prefab === "lampPost");
        const [local] = prefabs.lampPost.lights;
        const [x, y, z] = testfield.lightSpots[0];

        assert.equal(pine.y, testfield.heightAt(-8, -8));
        assert.ok(Math.abs(collider.radius - prefabs["pine.0"].colliders[0].radius * 1.1) < 1e-12);
        assert.ok(Math.abs(y - (lamp.y + local[1])) < 1e-12);
        assert.ok(Math.abs(Math.hypot(x - lamp.x, z - lamp.z) - Math.hypot(local[0], local[2])) < 1e-12);
    });

    it("bakes fence runs into colliders that follow the line", () =>
    {
        const run = testfield.runs[0];

        assert.ok(run.colliders.length >= 6);
        assert.ok(run.colliders.every((collider) => collider.radius === 0.3));
    });
});

describe("Zone view", () =>
{
    it("draws one top face for every column, in chunks of 32 cubes", () =>
    {
        const view = new ZoneView(hearthmere, prefabs, materials);
        const tops = view.terrainMeshes.reduce((total, mesh) =>
        {
            const normal = mesh.geometry.getAttribute("normal");
            let count = 0;

            for(let i = 0; i < normal.count; i += 4) { if(normal.getY(i) === 1) { count++; } }

            return total + count;
        }, 0);

        assert.ok(view.terrainMeshes.length >= 9 * 9 && view.terrainMeshes.length <= 9 * 9 * 2, view.terrainMeshes.length + " meshes");
        assert.equal(tops, 288 * 288);
        assert.ok(view.propMeshes.length > 10);
        view.dispose();
    });

    it("lights only the lamps nearest the focus, with a fixed number of lights", () =>
    {
        const view = new ZoneView(hearthmere, prefabs, materials);

        view.update(0.016, { position: view.sky.position.clone().set(0, 5, 10) }, { x: 0, y: 0.5, z: 0 });

        const lit = view.lamps.filter((light) => light.intensity > 0);

        assert.equal(view.lamps.length, ZoneView.LIGHT_BUDGET);
        assert.equal(lit.length, ZoneView.LIGHT_BUDGET);
        assert.ok(lit.every((light) => Math.hypot(light.position.x, light.position.z) < 14));
        view.dispose();
    });

    it("frees its geometry when disposed, and leaves the shared materials alone", () =>
    {
        const view = new ZoneView(testfield, prefabs, materials);
        const geometries = [...view.terrainMeshes, ...view.propMeshes].map((mesh) => mesh.geometry);
        const disposed = new Set();
        let isWorldDisposed = false;

        for(const geometry of geometries) { geometry.addEventListener("dispose", () => disposed.add(geometry)); }

        materials.world.addEventListener("dispose", () => { isWorldDisposed = true; });
        view.dispose();

        assert.equal(disposed.size, geometries.length);
        assert.equal(isWorldDisposed, false);
        assert.equal(view.scene.children.length, 0);
    });
});
