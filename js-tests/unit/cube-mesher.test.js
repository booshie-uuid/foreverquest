import * as CubeMesher from "../../js/render/cube-mesher.js";
import * as assert from "node:assert/strict";
import { describe, it } from "node:test";

const MARGIN = CubeMesher.PADDING;
const PADDED = 32 + MARGIN * 2;
const FRAME = { half: 0, base: 0, perCell: 0.25 };
const STONE = 1;
const LEAVES = 2;
const LAMP = 3;
const OVERLAYS = { mossTop: 40, mossEdge: 41, mossFoot: 42, grime: 43, cracks: 44 };
const WORN = 50;

function table()
{
    const faces = { top: new Int16Array([0, 10, 20, 30]), side: new Int16Array([0, 11, 21, 31]), bottom: new Int16Array([0, 12, 22, 32]) };
    const flags = () => new Uint8Array(256);
    const built = { ...faces, opaque: flags(), clear: flags(), liquid: flags(), hidden: flags(), standable: flags(), lights: flags() };

    built.opaque[STONE] = 1;
    built.opaque[LAMP] = 1;
    built.clear[LEAVES] = 1;
    built.standable[STONE] = 1;
    built.standable[LAMP] = 1;
    built.standable[LEAVES] = 1;
    built.lights[LAMP] = 12;
    built.weathers = flags();
    built.weathers[STONE] = 15;
    built.worn = new Int16Array(256).fill(-1);
    built.worn[STONE] = WORN;
    built.overlays = OVERLAYS;

    return built;
}

// A padded volume around the chunk at the origin, with each column's
// surface found from its cells, and every column at `age`.
function cells(fill, age = 0)
{
    const padded = new Uint8Array(PADDED * PADDED * PADDED);
    const surfaces = new Uint16Array(PADDED * PADDED);

    fill((x, y, z, block) => { padded[((y + MARGIN) * PADDED + z + MARGIN) * PADDED + x + MARGIN] = block; });

    for(let z = 0; z < PADDED; z++)
    {
        for(let x = 0; x < PADDED; x++)
        {
            for(let y = 0; y < PADDED; y++) { if(padded[(y * PADDED + z) * PADDED + x] !== 0) { surfaces[z * PADDED + x] = y + 1 - MARGIN; } }
        }
    }

    return { cells: padded, surfaces, ages: new Uint8Array(PADDED * PADDED).fill(age), bottom: -MARGIN };
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

    it("lights faces in steps: the open sky fully, under cover a level dimmer a cell, and near a lamp", () =>
    {
        const mesh = CubeMesher.meshCells(cells((set) =>
        {
            for(let x = 0; x < 32; x++) { for(let z = 0; z < 32; z++) { set(x, 0, z, STONE); } }
            for(let x = 10; x < 20; x++) { for(let z = 0; z < 32; z++) { set(x, 4, z, STONE); } }

            set(25, 1, 25, LAMP);
        }), table(), [0, 0, 0], FRAME);
        const floor = [];

        for(let v = 0; v < mesh.positions.length / 3; v++)
        {
            if(mesh.normals[v * 3 + 1] === 1 && Math.abs(mesh.positions[v * 3 + 1] - 1 / 3) < 1e-5) { floor.push([mesh.positions[v * 3], mesh.positions[v * 3 + 2], Math.round(mesh.lights[v * 2] * 15), Math.round(mesh.lights[v * 2 + 1] * 15)]); }
        }

        const skies = new Set(floor.map(([, , sky]) => sky));

        assert.ok(floor.some(([x, , sky]) => x < 3 && sky === 15), "The open floor is not fully lit");
        assert.deepEqual([12, 11, 10].map((level) => skies.has(level)), [true, true, true], "The floor under cover does not dim a level a cell");
        assert.ok(!skies.has(9), "The cover's middle is five cells from open sky, so no floor should be darker than 10");
        assert.ok(floor.some(([, , , lamp]) => lamp === 11), "No floor face takes the lamp's light");
    });

    it("weathers nothing at age 0, and at age 100 grows moss on open tops but not under cover, streaks grime under an overhang and wears some faces", () =>
    {
        const build = (set) =>
        {
            for(let x = 0; x < 16; x++)
            {
                for(let z = 0; z < 16; z++) { set(x, 0, z, STONE); }
            }

            for(let y = 1; y <= 4; y++)
            {
                for(let x = 2; x < 14; x++) { set(x, y, 8, STONE); }
            }

            for(let x = 2; x < 14; x++) { set(x, 5, 9, STONE); }
        };
        const young = CubeMesher.meshCells(cells(build, 0), table(), [0, 0, 0], FRAME);
        const old = CubeMesher.meshCells(cells(build, 100), table(), [0, 0, 0], FRAME);
        const codes = (mesh, channel, filter) => [...mesh.weathers].filter((value, i) => i % 2 === channel && filter(i >> 1)).map((code) => Math.floor(code / 4));
        const isTop = (vertex) => old.normals[vertex * 3 + 1] === 1;
        const isUnderOverhang = (vertex) => old.normals[vertex * 3 + 2] === 1 && Math.round(old.positions[vertex * 3 + 2] * 3) === 9 && old.positions[vertex * 3 + 1] * 3 <= 5;

        assert.ok(young.weathers.every((code) => code === 0));
        assert.ok(!young.layers.includes(WORN));
        assert.ok(codes(old, 0, isTop).filter((layer) => layer === OVERLAYS.mossTop).length > 20, "No moss on the open floor");
        assert.ok(codes(old, 1, isUnderOverhang).includes(OVERLAYS.grime), "No grime under the overhang");
        assert.deepEqual(codes(old, 0, isUnderOverhang).filter((layer) => layer > 0), [], "Moss grows under cover");
        assert.ok(old.layers.includes(WORN), "No face wore");
    });

    it("cuts a notch from an exposed edge of an old cube and keeps the cube closed", () =>
    {
        const build = (set) =>
        {
            for(let x = 1; x < 31; x += 3)
            {
                for(let z = 1; z < 31; z += 3) { set(x, 4, z, STONE); }
            }
        };
        const mesh = CubeMesher.meshCells(cells(build, 100), table(), [0, 0, 0], FRAME);
        const fractional = mesh.positions.filter((value) => Math.abs(value * 8 - Math.round(value * 8)) < 1e-6 && Math.abs(value - Math.round(value)) > 1e-6);
        const balance = [0, 1, 2].map(() => 0);

        for(const quad of quads(mesh))
        {
            const axis = quad.normal.findIndex((value) => value !== 0);

            balance[axis] += quad.normal[axis] * quad.area;
        }

        assert.ok(fractional.length > 0, "No cube lost a notch");
        assert.deepEqual(balance.map((value) => Math.round(value * 1e6) / 1e6), [0, 0, 0], "A chipped cube is not closed");
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
