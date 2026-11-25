import * as THREE from "three";
import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Water } from "../../js/render/water.js";

describe("Water", () =>
{
    it("covers the zone, and reaches past each side that ends in open water", () =>
    {
        const bounds = (reach) =>
        {
            const water = new Water(100, 8, 2, new THREE.MeshBasicMaterial(), reach);

            water.mesh.geometry.computeBoundingBox();

            const { min, max } = water.mesh.geometry.boundingBox;

            return [min.x, max.x, min.z, max.z, max.y];
        };

        assert.deepEqual(bounds({}), [-50, 50, -50, 50, 2]);
        assert.deepEqual(bounds({ south: 160, west: 40 }), [-90, 50, -50, 210, 2]);
    });
});
