import * as Generator from "./generator.js";
import * as zlib from "node:zlib";
import { ZoneData } from "../../js/sim/zone-data.js";

const SIZE = 384;
const COLOURS = [[80, 98, 60], [70, 86, 56], [84, 70, 52], [118, 108, 82], [104, 100, 94]];
const WATER = [46, 66, 84];
const FALL = [96, 122, 140];
const SHADE = 0.4;
const BOUND = [216, 72, 58];
const LINE = 1;


/******************************************************************************/
/* MAP                                                                        */
/******************************************************************************/

// An overhead map of the recipe, lit from the north-west, as a PNG data URL,
// with north at the top, and a red line where movement stops. It samples the
// zone at about SIZE points a side.
export function render(zone, recipe)
{
    const step = Math.max(1, Math.ceil(zone.columns / SIZE));
    const { field, grounds, bounds } = Generator.generate(zone, recipe, { step });
    const { size, heights, spacing } = field;
    const pixels = new Uint8Array(size * size * 4);
    const isOpen = openOf(field, bounds);

    for(let j = 0; j < size; j++)
    {
        for(let i = 0; i < size; i++)
        {
            const index = j * size + i;
            const across = heights[j * size + Math.min(size - 1, i + 1)] - heights[j * size + Math.max(0, i - 1)];
            const down = heights[Math.min(size - 1, j + 1) * size + i] - heights[Math.max(0, j - 1) * size + i];
            const light = Math.max(0.2, Math.min(1.5, 0.85 - ((across + down) / (2 * spacing)) * SHADE * 2));
            const isWater = heights[index] < field.water;
            const isFall = (field.marks[index] & Generator.MARKS.fall) !== 0;
            const isBound = !isOpen[index] && isNearOpen(isOpen, size, i, j);
            const colour = isBound ? BOUND : isFall ? FALL : isWater ? WATER : COLOURS[grounds[index]];
            const shade = isWater || isBound ? 1 : light;

            for(let c = 0; c < 3; c++) { pixels[index * 4 + c] = Math.min(255, colour[c] * shade); }

            pixels[index * 4 + 3] = 255;
        }
    }

    return "data:image/png;base64," + encode(size, size, pixels).toString("base64");
}

// Whether movement may reach each sample.
function openOf(field, bounds)
{
    const isOpen = new Uint8Array(field.size * field.size);

    field.each(null, (i, x, z) =>
    {
        const sides = { north: [z + field.half, x], south: [field.half - z, x], west: [x + field.half, z], east: [field.half - x, z] };

        isOpen[i] = Object.entries(sides).every(([side, [distance, along]]) => distance > (bounds[side]?.[Math.floor(along + field.half)] ?? ZoneData.EDGE_MARGIN)) ? 1 : 0;
    });

    return isOpen;
}

function isNearOpen(isOpen, size, i, j)
{
    for(let dj = -LINE; dj <= LINE; dj++)
    {
        for(let di = -LINE; di <= LINE; di++)
        {
            const [ni, nj] = [i + di, j + dj];

            if(ni >= 0 && ni < size && nj >= 0 && nj < size && isOpen[nj * size + ni]) { return true; }
        }
    }

    return false;
}

// A PNG of 8-bit RGBA pixels, with no filtering.
export function encode(width, height, pixels)
{
    const rows = Buffer.alloc((width * 4 + 1) * height);

    for(let y = 0; y < height; y++) { Buffer.from(pixels.buffer, pixels.byteOffset + y * width * 4, width * 4).copy(rows, y * (width * 4 + 1) + 1); }

    const header = Buffer.alloc(13);

    header.writeUInt32BE(width, 0);
    header.writeUInt32BE(height, 4);
    header.set([8, 6, 0, 0, 0], 8);

    return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", zlib.deflateSync(rows)), chunk("IEND", Buffer.alloc(0))]);
}

function chunk(type, data)
{
    const length = Buffer.alloc(4);
    const crc = Buffer.alloc(4);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);

    length.writeUInt32BE(data.length);
    crc.writeUInt32BE(zlib.crc32(body));

    return Buffer.concat([length, body, crc]);
}
