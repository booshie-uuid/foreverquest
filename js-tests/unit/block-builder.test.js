import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BlockBuilder } from "../../js/geometry/block-builder.js";
import { Sheet } from "../../js/character/sheet.js";

function faceCentres(geometry)
{
    const position = geometry.getAttribute("position");
    const normal = geometry.getAttribute("normal");
    const faces = [];

    for(let i = 0; i < position.count; i += 6)
    {
        let x = 0;
        let y = 0;
        let z = 0;

        for(let j = 0; j < 6; j++)
        {
            x += position.getX(i + j) / 6;
            y += position.getY(i + j) / 6;
            z += position.getZ(i + j) / 6;
        }

        faces.push({ centre: [x, y, z], normal: [normal.getX(i), normal.getY(i), normal.getZ(i)] });
    }

    return faces;
}

describe("BlockBuilder", () =>
{
    it("builds six outward faces with the given UVs and layer", () =>
    {
        const builder = new BlockBuilder();

        builder.add([2, 4, 6], [1, 2, 3], null, () => ({ uv: [0.25, 0.25, 0.75, 0.75], layer: 4 }));

        const geometry = builder.build();
        const faces = faceCentres(geometry);

        assert.equal(geometry.getAttribute("position").count, 36);
        assert.ok(geometry.getAttribute("layer").array.every((layer) => layer === 4));
        assert.ok(geometry.getAttribute("uv").array.every((value) => value === 0.25 || value === 0.75));

        for(const { centre, normal } of faces)
        {
            const outward = [centre[0] - 1, centre[1] - 2, centre[2] - 3];
            const dot = outward[0] * normal[0] + outward[1] * normal[1] + outward[2] * normal[2];

            assert.ok(dot > 0, "A face points inwards at " + centre.join(", "));
        }
    });

    it("winds each face so its normal matches the triangle order", () =>
    {
        const builder = new BlockBuilder();

        builder.add([1, 1, 1], [0, 0, 0], [0.3, 0.8, 0.1], () => ({ uv: [0, 0, 1, 1] }));

        const p = builder.positions;
        const n = builder.normals;

        for(let i = 0; i < p.length; i += 9)
        {
            const ab = [p[i + 3] - p[i], p[i + 4] - p[i + 1], p[i + 5] - p[i + 2]];
            const ac = [p[i + 6] - p[i], p[i + 7] - p[i + 1], p[i + 8] - p[i + 2]];
            const cross = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];

            assert.ok(cross[0] * n[i] + cross[1] * n[i + 1] + cross[2] * n[i + 2] > 0);
        }
    });

    it("leaves out faces mapped to null", () =>
    {
        const builder = new BlockBuilder();

        builder.add([1, 1, 1], [0, 0, 0], null, (face) => (face === "top" ? { uv: [0, 0, 1, 1] } : null));

        assert.equal(builder.triangleCount, 2);
    });

    it("reports each face's width and height in the block's axes", () =>
    {
        assert.deepEqual(BlockBuilder.faceSize("front", [2, 3, 4]), [2, 3]);
        assert.deepEqual(BlockBuilder.faceSize("left", [2, 3, 4]), [4, 3]);
        assert.deepEqual(BlockBuilder.faceSize("top", [2, 3, 4]), [2, 4]);
    });
});

describe("Sheet", () =>
{
    it("packs faces without overlap inside its width", () =>
    {
        const sheet = new Sheet(64);
        const areas = [];

        for(const size of [[16, 16, 16], [24, 32, 12], [8, 32, 8], [3, 40, 2]]) { areas.push(...Object.values(sheet.reserve(size))); }

        for(const area of areas) { assert.ok(area.x >= 0 && area.x + area.w <= 64, JSON.stringify(area)); }

        for(let i = 0; i < areas.length; i++)
        {
            for(let j = i + 1; j < areas.length; j++)
            {
                const a = areas[i];
                const b = areas[j];
                const isApart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;

                assert.ok(isApart, "Areas overlap: " + JSON.stringify(a) + " " + JSON.stringify(b));
            }
        }
    });

    it("maps an area's top row to the top of its UVs once the rows flip", () =>
    {
        const sheet = new Sheet(16);
        const area = sheet.allocate(4, 4);

        sheet.open();
        sheet.raster.set(0, 0, [255, 0, 0, 255]);

        const [, v0, , v1] = sheet.uv(area);
        const texture = Sheet.texture(sheet.raster);
        const lastRow = (sheet.raster.height - 1) * 16 * 4;

        assert.ok(v1 > v0);
        assert.ok(v1 > 0.99);
        assert.equal(texture.image.data[lastRow], 255);
    });

    it("refuses a face wider than the sheet", () =>
    {
        assert.throws(() => new Sheet(32).allocate(40, 2), /wider than the sheet/);
    });
});
