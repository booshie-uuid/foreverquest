// A region file, before compression, is little-endian:
//   "FQRG", version, chunk size, width, depth and height in cells (u16 each),
//   one u16 surface per column (the top solid cell + 1, or 0), a u16 chunk
//   count, then per chunk its x, y and z within the region, a mode byte and
//   either one block (uniform) or every cell in (y * size + z) * size + x
//   order (dense). Chunks of air are left out.

const MAGIC = "FQRG";
const VERSION = 1;
const UNIFORM = 0;
const DENSE = 1;

export const CHUNK = 32;
export const REGION = 256;
export const CELLS = CHUNK * CHUNK * CHUNK;


/******************************************************************************/
/* ENCODE                                                                     */
/******************************************************************************/

// `chunks` holds { x, y, z, cells } with a Uint8Array of CELLS blocks.
export function encode({ width, depth, height, surfaces, chunks })
{
    const stored = chunks.map((chunk) => ({ ...chunk, uniform: uniformOf(chunk.cells) })).filter((chunk) => chunk.uniform !== 0);
    const size = 12 + surfaces.length * 2 + 2 + stored.reduce((total, chunk) => total + 4 + (chunk.uniform === null ? CELLS : 1), 0);
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

    view.setUint16(at, stored.length, true);
    at += 2;

    for(const chunk of stored)
    {
        bytes.set([chunk.x, chunk.y, chunk.z, chunk.uniform === null ? DENSE : UNIFORM], at);
        at += 4;

        if(chunk.uniform === null)
        {
            bytes.set(chunk.cells, at);
            at += CELLS;
        }
        else
        {
            bytes[at++] = chunk.uniform;
        }
    }

    return bytes;
}

function uniformOf(cells)
{
    const first = cells[0];

    for(let i = 1; i < cells.length; i++) { if(cells[i] !== first) { return null; } }

    return first;
}


/******************************************************************************/
/* DECODE                                                                     */
/******************************************************************************/

// A uniform chunk decodes with `uniform` set and no cells.
export function decode(bytes)
{
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const magic = String.fromCharCode(...bytes.subarray(0, 4));

    if(magic !== MAGIC || bytes[4] !== VERSION || bytes[5] !== CHUNK) { throw new Error("The region file is not version " + VERSION + " with " + CHUNK + "-cell chunks"); }

    const width = view.getUint16(6, true);
    const depth = view.getUint16(8, true);
    const height = view.getUint16(10, true);
    const surfaces = new Uint16Array(width * depth);
    let at = 12;

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

        if(mode === DENSE)
        {
            chunks.push({ x, y, z, uniform: null, cells: bytes.slice(at, at + CELLS) });
            at += CELLS;
        }
        else
        {
            chunks.push({ x, y, z, uniform: bytes[at++], cells: null });
        }
    }

    return { width, depth, height, surfaces, chunks };
}
