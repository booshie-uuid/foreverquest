// A region file, before compression, is little-endian:
//   "FQRG", version, chunk size, width, depth and height in cells (u16 each),
//   one u16 surface per column (the top solid cell + 1, or 0), a u16 chunk
//   count, then per chunk its x, y and z within the region, a mode byte and
//   its cells in (y * size + z) * size + x order: one block (uniform), every
//   cell (dense), or a u16 run count and runs of u16 length and one block
//   (runs). Chunks of air are left out.

const MAGIC = "FQRG";
const VERSION = 2;
const UNIFORM = 0;
const DENSE = 1;
const RUNS = 2;
const HEADER = 12;

export const CHUNK = 32;
export const REGION = 256;
export const CELLS = CHUNK * CHUNK * CHUNK;


/******************************************************************************/
/* ENCODE                                                                     */
/******************************************************************************/

// `chunks` holds { x, y, z, cells } with a Uint8Array of CELLS blocks.
export function encode({ width, depth, height, surfaces, chunks })
{
    const payloads = chunks.map((chunk) => ({ chunk, payload: payloadOf(chunk.cells) })).filter(({ payload }) => payload !== null);
    const size = HEADER + surfaces.length * 2 + 2 + payloads.reduce((total, { payload }) => total + 4 + payload.bytes.length, 0);
    const bytes = new Uint8Array(size);
    const view = new DataView(bytes.buffer);
    let at = 0;

    for(const letter of MAGIC) { bytes[at++] = letter.charCodeAt(0); }

    bytes[at++] = VERSION;
    bytes[at++] = CHUNK;
    view.setUint16(at, width, true);
    view.setUint16(at + 2, depth, true);
    view.setUint16(at + 4, height, true);
    at += 6;

    for(const surface of surfaces)
    {
        view.setUint16(at, surface, true);
        at += 2;
    }

    view.setUint16(at, payloads.length, true);
    at += 2;

    for(const { chunk, payload } of payloads)
    {
        bytes.set([chunk.x, chunk.y, chunk.z, payload.mode], at);
        bytes.set(payload.bytes, at + 4);
        at += 4 + payload.bytes.length;
    }

    return bytes;
}

// Null for a chunk of air.
function payloadOf(cells)
{
    const runs = runsOf(cells);

    if(runs.length === 1) { return runs[0][1] === 0 ? null : { mode: UNIFORM, bytes: Uint8Array.of(runs[0][1]) }; }
    if(2 + runs.length * 3 >= CELLS) { return { mode: DENSE, bytes: cells }; }

    const bytes = new Uint8Array(2 + runs.length * 3);
    const view = new DataView(bytes.buffer);

    view.setUint16(0, runs.length, true);
    runs.forEach(([length, block], i) =>
    {
        view.setUint16(2 + i * 3, length, true);
        bytes[4 + i * 3] = block;
    });

    return { mode: RUNS, bytes };
}

function runsOf(cells)
{
    const runs = [];
    let start = 0;

    for(let i = 1; i <= cells.length; i++)
    {
        if(i === cells.length || cells[i] !== cells[start])
        {
            runs.push([i - start, cells[start]]);
            start = i;
        }
    }

    return runs;
}


/******************************************************************************/
/* DECODE                                                                     */
/******************************************************************************/

// A uniform chunk decodes with `uniform` set and no cells; the others decode
// to every cell.
export function decode(bytes)
{
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const magic = String.fromCharCode(...bytes.subarray(0, 4));

    if(magic !== MAGIC || bytes[4] !== VERSION || bytes[5] !== CHUNK) { throw new Error("The region file is not version " + VERSION + " with " + CHUNK + "-cell chunks"); }

    const width = view.getUint16(6, true);
    const depth = view.getUint16(8, true);
    const height = view.getUint16(10, true);
    const surfaces = new Uint16Array(width * depth);
    let at = HEADER;

    for(let i = 0; i < surfaces.length; i++)
    {
        surfaces[i] = view.getUint16(at, true);
        at += 2;
    }

    const count = view.getUint16(at, true);
    const chunks = [];

    at += 2;

    for(let i = 0; i < count; i++)
    {
        const [x, y, z, mode] = bytes.subarray(at, at + 4);

        at += 4;

        if(mode === UNIFORM)
        {
            chunks.push({ x, y, z, uniform: bytes[at++], cells: null });
        }
        else if(mode === DENSE)
        {
            chunks.push({ x, y, z, uniform: null, cells: bytes.slice(at, at + CELLS) });
            at += CELLS;
        }
        else
        {
            const cells = new Uint8Array(CELLS);
            const runs = view.getUint16(at, true);
            let cell = 0;

            at += 2;

            for(let run = 0; run < runs; run++)
            {
                const length = view.getUint16(at, true);

                cells.fill(bytes[at + 2], cell, cell + length);
                cell += length;
                at += 3;
            }

            chunks.push({ x, y, z, uniform: null, cells });
        }
    }

    return { width, depth, height, surfaces, chunks };
}
