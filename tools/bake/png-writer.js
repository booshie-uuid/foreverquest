import * as zlib from "node:zlib";

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const RGBA = 6;

export function encode(width, height, data)
{
    if(data.length !== width * height * 4) { throw new Error("The texel data does not match " + width + " by " + height); }

    const stride = width * 4;
    const raw = Buffer.alloc((stride + 1) * height);

    for(let y = 0; y < height; y++) { raw.set(data.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1); }

    const header = Buffer.alloc(13);

    header.writeUInt32BE(width, 0);
    header.writeUInt32BE(height, 4);
    header[8] = 8;
    header[9] = RGBA;

    return Buffer.concat([SIGNATURE, chunk("IHDR", header), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

function chunk(type, body)
{
    const length = Buffer.alloc(4);
    const crc = Buffer.alloc(4);
    const typed = Buffer.concat([Buffer.from(type, "ascii"), body]);

    length.writeUInt32BE(body.length);
    crc.writeUInt32BE(zlib.crc32(typed));

    return Buffer.concat([length, typed, crc]);
}
