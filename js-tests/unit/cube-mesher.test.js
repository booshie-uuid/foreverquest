import * as CubeMesher from "../../js/render/cube-mesher.js";
import * as assert from "node:assert/strict";
import { describe, it } from "node:test";

const PADDED = 34;
const FRAME = { half: 0, base: 0, perCell: 0.25 };
const STONE = 1;
const LEAVES = 2;

function table()
{
    const faces = { top: new Int16Array([0, 10, 20]), side: new Int16Array([0, 11, 21]), bottom: new Int16Array([0, 12, 22]) };
    const flags = () => new Uint8Array(256);
    const built = { ...faces, opaque: flags(), clear: flags(), liquid: flags() };

    built.opaque[STONE] = 1;
    built.clear[LEAVES] = 1;

    return built;
}

function cells(fill)
{
    const padded = new Uint8Array(PADDED * PADDED * PADDED);

    fill((x, y, z, block) => { padded[((y + 1) * PADDED + z + 1) * PADDED + x + 1] = block; });

    return padded;
}

function quads(mesh)
{
    const list = [];

    for(let q = 0; q < mesh.positions.length / 12; q++)
    {
        const corner = (k) => [...mesh.positions.subarray((q * 4 + k) * 3, (q * 4 + k) * 3 + 3)];
        const [a, b, , d] = [0, 1, 2, 3].map(corner);
        const normal = [...mesh.normals.subarray(q * 12, q * 12 + 3)];

        list.push({ normal, uv: [...mesh.uvs.subarray(q * 8, q * 8 + 8)], area: Math.hypot(...b.map((value, i) => value - a[i])) * Math.hypot(...d.map((value, i) => value - a[i])), shades: [0, 1, 2, 3].map((k) => mesh.colours[(q * 4 + k) * 3]), layer: mesh.layers[q * 4] });
    }

    return list;
}

describe("Cube mesher", () =>
{
    it("draws a lone cube as six faces, one texture per side", () =>
    {
        const mesh = CubeMesher.meshCells(cells((set) => set(3, 3, 3, STONE)), table(), [0, 0, 0], FRAME);
        const list = quads(mesh);

        assert.equal(list.length, 6);
        assert.deepEqual(list.map((quad) => quad.layer).sort(), [10, 11, 11, 11, 11, 12]);
        assert.ok(list.every((quad) => Math.abs(quad.area - 1 / 9) < 1e-5 && quad.shades.every((shade) => shade === 1)));
    });

    it("merges a flat floor into one face a side and hides the faces between cubes", () =>
    {
        const mesh = CubeMesher.meshCells(cells((set) =>
        {
            for(let x = 0; x < 32; x++) { for(let z = 0; z < 32; z++) { set(x, 0, z, STONE); } }
        }), table(), [0, 0, 0], FRAME);
        const tops = quads(mesh).filter((quad) => quad.normal[1] === 1);

        assert.equal(tops.length, 1);
        assert.ok(Math.abs(tops[0].area - (32 / 3) ** 2) < 1e-5);
        assert.deepEqual([Math.abs(tops[0].uv[2] - tops[0].uv[0]), Math.abs(tops[0].uv[7] - tops[0].uv[1])], [8, 8], "The texture repeats once every four cubes");
    });

    it("darkens the floor's corners where a cube stands on it", () =>
    {
        const mesh = CubeMesher.meshCells(cells((set) =>
        {
            for(let x = 0; x < 5; x++) { for(let z = 0; z < 5; z++) { set(x, 0, z, STONE); } }

            set(2, 1, 2, STONE);
        }), table(), [0, 0, 0], FRAME);
        const tops = quads(mesh).filter((quad) => quad.normal[1] === 1);
        const shaded = tops.filter((quad) => quad.shades.some((shade) => shade < 1));

        assert.ok(shaded.length > 0);
        assert.ok(tops.some((quad) => quad.shades.every((shade) => shade === 1)));
        assert.ok(Math.abs(tops.reduce((total, quad) => total + quad.area, 0) - 25 / 9) < 1e-5);
    });

    it("winds every triangle to face along its normal", () =>
    {
        const mesh = CubeMesher.meshCells(cells((set) =>
        {
            set(3, 3, 3, STONE);
            set(4, 3, 3, STONE);
            set(3, 4, 3, STONE);
            set(8, 3, 3, LEAVES);
        }), table(), [0, 0, 0], FRAME);

        for(let t = 0; t < mesh.indices.length; t += 3)
        {
            const [a, b, c] = [0, 1, 2].map((k) => [...mesh.positions.subarray(mesh.indices[t + k] * 3, mesh.indices[t + k] * 3 + 3)]);
            const ab = b.map((value, i) => value - a[i]);
            const ac = c.map((value, i) => value - a[i]);
            const cross = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
            const normal = [...mesh.normals.subarray(mesh.indices[t] * 3, mesh.indices[t] * 3 + 3)];

            assert.ok(cross[0] * normal[0] + cross[1] * normal[1] + cross[2] * normal[2] > 0, "Triangle " + t / 3 + " faces away from " + normal);
        }
    });

    it("draws see-through blocks beside each other only on their outer faces", () =>
    {
        const mesh = CubeMesher.meshCells(cells((set) =>
        {
            set(3, 3, 3, LEAVES);
            set(4, 3, 3, LEAVES);
            set(3, 3, 4, STONE);
        }), table(), [0, 0, 0], FRAME);
        const leaves = quads(mesh).filter((quad) => quad.layer >= 20);

        assert.ok(Math.abs(leaves.reduce((total, quad) => total + quad.area * 9, 0) - 9) < 1e-5);
    });
});
