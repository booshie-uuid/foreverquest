import * as THREE from "three";
import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Bench } from "../../js/editor/bench.js";

// Eight fine cubes a side, with a column of fine cubes at x 4, z 4 up to y 5.
const SIZE = [8, 8, 8];
const DATA = new Uint8Array(512);

for(let y = 0; y <= 5; y++) { DATA[(y * 8 + 4) * 8 + 4] = 1; }

const GRID = { size: SIZE, data: DATA };

describe("The bench's ray", () =>
{
    it("finds the first fine cube along it, with the face it entered by", () =>
    {
        const fromFront = Bench.march(GRID, 8, new THREE.Vector3(4.5, 2.5, 20), new THREE.Vector3(0, 0, -1));
        const fromAbove = Bench.march(GRID, 8, new THREE.Vector3(4.5, 20, 4.5), new THREE.Vector3(0, -1, 0));

        assert.deepEqual(fromFront, { cell: [4, 2, 4], normal: [0, 0, 1] });
        assert.deepEqual(fromAbove, { cell: [4, 5, 4], normal: [0, 1, 0] });
    });

    it("passes through the fine cubes above the slice, and misses an empty line", () =>
    {
        assert.deepEqual(Bench.march(GRID, 3, new THREE.Vector3(4.5, 20, 4.5), new THREE.Vector3(0, -1, 0)), { cell: [4, 2, 4], normal: [0, 1, 0] });
        assert.equal(Bench.march(GRID, 8, new THREE.Vector3(1.5, 2.5, 20), new THREE.Vector3(0, 0, -1)), null);
        assert.equal(Bench.march(GRID, 8, new THREE.Vector3(4.5, 2.5, 20), new THREE.Vector3(0, 0, 1)), null);
    });
});
