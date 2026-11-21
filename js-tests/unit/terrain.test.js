import * as TestAssets from "../helpers/assets.js";
import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Terrain } from "../../js/world/terrain.js";
import { World } from "../../js/world/world.js";

const terrain = new Terrain(7);
const materials = await TestAssets.materials();

describe("Terrain", () =>
{
    it("rises and falls in quarter-metre steps", () =>
    {
        for(let i = 0; i < 400; i++)
        {
            const height = terrain.heightAt(-47 + (i % 20) * 4.7, -47 + Math.floor(i / 20) * 4.7);

            assert.ok(Math.abs(height / Terrain.STEP - Math.round(height / Terrain.STEP)) < 1e-9, "Height " + height);
        }
    });

    it("keeps one height across each tile", () =>
    {
        assert.equal(terrain.heightAt(3.05, -7.05), terrain.heightAt(3.95, -7.95));
    });

    it("keeps the village square flat and dry and floods the lake", () =>
    {
        for(const [x, z] of [[0, 0], [5, 3], [-4, -5], [10, 2]]) { assert.equal(terrain.heightAt(x, z), 0.5, x + ", " + z); }

        assert.equal(terrain.typeAt(0, 0), "cobble");
        assert.ok(terrain.isWater(22, 16));
    });

    it("is the same for the same seed", () =>
    {
        assert.equal(new Terrain(7).heightAt(12.3, -40.1), terrain.heightAt(12.3, -40.1));
    });

    it("builds a top for every tile and a side for every drop", () =>
    {
        const geometry = terrain.buildMesh(null, materials.atlas).geometry;
        const normal = geometry.getAttribute("normal");
        let tops = 0;

        for(let i = 0; i < normal.count; i += 6) { if(normal.getY(i) === 1) { tops++; } }

        assert.equal(tops, terrain.size * terrain.size);
        assert.ok(normal.count / 6 > tops, "No tile has a side");
    });
});

describe("World collisions", () =>
{
    const world = new World(materials);

    it("pushes a circle out of a rotated box", () =>
    {
        const box = { x: 0, z: 0, halfWidth: 2, halfDepth: 1, angle: Math.PI / 2 };
        const point = { x: 0.2, z: 1.5 };

        World.pushOutOfBox(point, box, 0.5);

        assert.ok(Math.abs(point.z) >= 2.5 - 1e-9 || Math.abs(point.x) >= 1.5 - 1e-9, JSON.stringify(point));
    });

    it("stops a step into the well and a step into the lake", () =>
    {
        const intoWell = world.resolveStep({ x: 0, z: 2 }, { x: 0, z: 0.5 }, 0.35);

        assert.ok(Math.hypot(intoWell.x, intoWell.z) >= 1.2 + 0.35 - 1e-6);
        assert.deepEqual(world.resolveStep({ x: 21, z: 16 }, { x: 22, z: 16 }, 0.35), { x: 21, z: 16 });
    });

    it("refuses a step up more than half a metre", () =>
    {
        const from = { x: 0.5, z: 0.5 };

        assert.equal(world.canStep(from, { x: 0.6, z: 0.6 }), true);

        for(let x = -40; x < 40; x++)
        {
            for(let z = -40; z < 40; z++)
            {
                const step = world.heightAt(x + 1.5, z + 0.5) - world.heightAt(x + 0.5, z + 0.5);

                if(step > 0.5 && world.isWalkable(x + 1.5, z + 0.5))
                {
                    assert.equal(world.canStep({ x: x + 0.5, z: z + 0.5 }, { x: x + 1.5, z: z + 0.5 }), false);

                    return;
                }
            }
        }

        assert.fail("The terrain has no step taller than half a metre to test");
    });
});
