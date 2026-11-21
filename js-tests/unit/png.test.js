import * as Png from "../../js/engine/png.js";
import * as PngWriter from "../../tools/bake/png-writer.js";
import * as assert from "node:assert/strict";
import * as zlib from "node:zlib";
import { describe, it } from "node:test";
import { Random } from "../../js/util/random.js";

function texels(width, height, seed)
{
    const random = new Random(seed);

    return Uint8Array.from({ length: width * height * 4 }, () => Math.floor(random.next() * 256));
}

// The writer uses no row filters, so this rebuilds its output with the given
// filter on each row.
function filtered(width, height, data, filterOf)
{
    const stride = width * 4;
    const raw = new Uint8Array((stride + 1) * height);

    for(let y = 0; y < height; y++)
    {
        const filter = filterOf(y);

        raw[y * (stride + 1)] = filter;

        for(let x = 0; x < stride; x++)
        {
            const left = x >= 4 ? data[y * stride + x - 4] : 0;
            const up = y > 0 ? data[(y - 1) * stride + x] : 0;
            const upLeft = y > 0 && x >= 4 ? data[(y - 1) * stride + x - 4] : 0;
            const estimate = left + up - upLeft;
            const paeth = [left, up, upLeft].reduce((best, value) => (Math.abs(estimate - value) < Math.abs(estimate - best) ? value : best));
            const prediction = [0, left, up, (left + up) >> 1, paeth][filter];

            raw[y * (stride + 1) + 1 + x] = (data[y * stride + x] - prediction) & 255;
        }
    }

    const plain = PngWriter.encode(width, height, data);
    const idatStart = plain.indexOf("IDAT") - 4;
    const idatLength = plain.readUInt32BE(idatStart);
    const deflated = zlib.deflateSync(raw);
    const length = Buffer.alloc(4);

    length.writeUInt32BE(deflated.length);

    return Buffer.concat([plain.subarray(0, idatStart), length, Buffer.from("IDAT"), deflated, Buffer.alloc(4), plain.subarray(idatStart + 12 + idatLength)]);
}

describe("Png", () =>
{
    it("decodes what the writer encodes, texel for texel", async () =>
    {
        const data = texels(13, 7, 4);
        const image = await Png.decode(PngWriter.encode(13, 7, data));

        assert.equal(image.width, 13);
        assert.equal(image.height, 7);
        assert.deepEqual(image.data, data);
    });

    it("undoes every row filter", async () =>
    {
        const data = texels(9, 10, 8);
        const image = await Png.decode(filtered(9, 10, data, (y) => y % 5));

        assert.deepEqual(image.data, data);
    });

    it("writes the same bytes for the same texels", () =>
    {
        const data = texels(16, 16, 2);

        assert.deepEqual(PngWriter.encode(16, 16, data), PngWriter.encode(16, 16, data));
    });

    it("rejects a file that is not a PNG, and texels that do not fit the size", async () =>
    {
        await assert.rejects(Png.decode(new TextEncoder().encode("GIF89a, not a PNG")), /not a PNG/);
        assert.throws(() => PngWriter.encode(4, 4, new Uint8Array(10)), /does not match/);
    });
});
