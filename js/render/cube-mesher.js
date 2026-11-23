import * as RegionCodec from "../sim/region-codec.js";
import { ZoneData } from "../sim/zone-data.js";

const { CHUNK } = RegionCodec;
const PADDED = CHUNK + 2;
const BEDROCK = 255;
const SHADES = [1, 0.84, 0.72, 0.6];
const CORNERS = [[0, 0], [1, 0], [1, 1], [0, 1]];

// Texture coordinates come from a corner's cell position.
const DIRECTIONS =
[
    { axis: 0, sign: 1, u: 2, v: 1, side: "side", uv: ([, y, z]) => [-z, y] },
    { axis: 0, sign: -1, u: 2, v: 1, side: "side", uv: ([, y, z]) => [z, y] },
    { axis: 1, sign: 1, u: 0, v: 2, side: "top", uv: ([x, , z]) => [x, -z] },
    { axis: 1, sign: -1, u: 0, v: 2, side: "bottom", uv: ([x, , z]) => [x, z] },
    { axis: 2, sign: 1, u: 0, v: 1, side: "side", uv: ([x, y]) => [x, y] },
    { axis: 2, sign: -1, u: 0, v: 1, side: "side", uv: ([x, y]) => [-x, y] },
];


/******************************************************************************/
/* FACE TABLE                                                                 */
/******************************************************************************/

export function faceTable(blocks, atlas)
{
    const count = blocks.count + 1;
    const table = { top: new Int16Array(count), side: new Int16Array(count), bottom: new Int16Array(count), opaque: new Uint8Array(256), clear: new Uint8Array(256), liquid: new Uint8Array(256) };

    for(let number = 1; number < count; number++)
    {
        const block = blocks.block(number);

        for(const side of ["top", "side", "bottom"]) { table[side][number] = atlas.layer(block.faces[side]); }

        table.opaque[number] = block.kind === "solid" ? 1 : 0;
        table.clear[number] = block.kind === "clear" ? 1 : 0;
        table.liquid[number] = block.kind === "liquid" ? 1 : 0;
    }

    table.opaque[BEDROCK] = 1;

    return table;
}


/******************************************************************************/
/* CHUNKS                                                                     */
/******************************************************************************/

// Returns null for a chunk with no visible face. Liquids are left to the
// water view.
export function buildChunk(zone, table, atlas, cx, cy, cz)
{
    const frame = { half: zone.half, base: zone.base, perCell: atlas.uvPerMetre / ZoneData.CUBES_PER_METRE };

    return meshCells(paddedCells(zone, cx, cy, cz), table, [cx * CHUNK, cy * CHUNK, cz * CHUNK], frame);
}

// `cells` is a chunk with a one-cell border of its neighbours, in
// (y * 34 + z) * 34 + x order.
export function meshCells(cells, table, origin, frame)
{
    const out = { positions: [], normals: [], uvs: [], layers: [], colours: [], indices: [] };
    const mask = new Int32Array(CHUNK * CHUNK);

    for(const direction of DIRECTIONS)
    {
        for(let slice = 1; slice <= CHUNK; slice++)
        {
            if(fillMask(mask, cells, table, direction, slice)) { mergeMask(out, mask, direction, slice, origin, frame); }
        }
    }

    if(out.indices.length === 0) { return null; }

    return {
        positions: new Float32Array(out.positions),
        normals: new Float32Array(out.normals),
        uvs: new Float32Array(out.uvs),
        layers: new Float32Array(out.layers),
        colours: new Float32Array(out.colours),
        indices: new Uint32Array(out.indices),
    };
}

/* CELLS **********************************************************************/

// Cells below the zone, and in regions not loaded, count as solid.
export function paddedCells(zone, cx, cy, cz)
{
    const cells = new Uint8Array(PADDED * PADDED * PADDED);
    const [left, bottom, back] = [cx * CHUNK - 1, cy * CHUNK - 1, cz * CHUNK - 1];
    const chunk = zone.chunkAt(cx, cy, cz);

    for(let y = 0; y < PADDED; y++)
    {
        for(let z = 0; z < PADDED; z++)
        {
            const isInnerRow = y > 0 && y <= CHUNK && z > 0 && z <= CHUNK;

            for(let x = 0; x < PADDED; x++)
            {
                const cellY = bottom + y;
                let block = BEDROCK;

                if(cellY >= 0 && isInnerRow && x > 0 && x <= CHUNK) { block = chunkCell(chunk, x - 1, y - 1, z - 1); }
                else if(cellY >= 0 && (!zone.isCell(left + x, cellY, back + z) || zone.isColumnLoaded(left + x, back + z))) { block = zone.blockAt(left + x, cellY, back + z); }

                cells[(y * PADDED + z) * PADDED + x] = block;
            }
        }
    }

    return cells;
}

function chunkCell(chunk, x, y, z)
{
    if(!chunk) { return 0; }
    if(chunk.cells === null) { return chunk.uniform; }

    return chunk.cells[(y * CHUNK + z) * CHUNK + x];
}

// The step through the padded cells along x, y and z.
const STRIDES = [1, PADDED * PADDED, PADDED];

/* MASK ***********************************************************************/

// A mask entry is 0 for no face, or the face's layer + 1 shifted above its
// four corner shades, two bits each.
function fillMask(mask, cells, table, direction, slice)
{
    const { axis, sign, u, v, side } = direction;
    const [stepU, stepV, stepAxis] = [STRIDES[u], STRIDES[v], STRIDES[axis]];
    const layers = table[side];
    let hasFace = false;

    for(let j = 0; j < CHUNK; j++)
    {
        let index = slice * stepAxis + stepU + (j + 1) * stepV;

        for(let i = 0; i < CHUNK; i++, index += stepU)
        {
            const block = cells[index];
            const front = index + sign * stepAxis;
            const neighbour = cells[front];
            const isHidden = block === 0 || table.liquid[block] === 1 || table.opaque[neighbour] === 1 || (table.clear[block] === 1 && neighbour === block);

            if(isHidden)
            {
                mask[j * CHUNK + i] = 0;
                continue;
            }

            mask[j * CHUNK + i] = ((layers[block] + 1) << 8) | shadesOf(cells, table.opaque, front, stepU, stepV);
            hasFace = true;
        }
    }

    return hasFace;
}

// Vertex ambient occlusion, after
// https://0fps.net/2013/07/03/ambient-occlusion-for-minecraft-like-worlds/
function shadesOf(cells, opaque, front, stepU, stepV)
{
    let packed = 0;

    for(let corner = 0; corner < 4; corner++)
    {
        const du = CORNERS[corner][0] * 2 - 1;
        const dv = CORNERS[corner][1] * 2 - 1;
        const a = opaque[cells[front + du * stepU]];
        const b = opaque[cells[front + dv * stepV]];
        const shade = a && b ? 3 : a + b + opaque[cells[front + du * stepU + dv * stepV]];

        packed |= shade << (corner * 2);
    }

    return packed;
}

/* QUADS **********************************************************************/

function mergeMask(out, mask, direction, slice, origin, frame)
{
    for(let j = 0; j < CHUNK; j++)
    {
        for(let i = 0; i < CHUNK;)
        {
            const key = mask[j * CHUNK + i];

            if(key === 0)
            {
                i++;
                continue;
            }

            let width = 1;
            let height = 1;

            while(i + width < CHUNK && mask[j * CHUNK + i + width] === key) { width++; }
            while(j + height < CHUNK && rowMatches(mask, key, i, j + height, width)) { height++; }

            for(let row = j; row < j + height; row++) { mask.fill(0, row * CHUNK + i, row * CHUNK + i + width); }

            addQuad(out, direction, key, [slice, i, j, width, height], origin, frame);
            i += width;
        }
    }
}

function rowMatches(mask, key, i, j, width)
{
    for(let k = i; k < i + width; k++) { if(mask[j * CHUNK + k] !== key) { return false; } }

    return true;
}

function addQuad(out, direction, key, [slice, i, j, width, height], origin, frame)
{
    const { axis, sign, u, v } = direction;
    const first = out.positions.length / 3;
    const layer = (key >> 8) - 1;
    const shades = CORNERS.map((corner, index) => (key >> (index * 2)) & 3);
    const normal = [0, 0, 0];

    normal[axis] = sign;

    CORNERS.forEach(([cornerU, cornerV], index) =>
    {
        const cell = [0, 0, 0];

        cell[axis] = origin[axis] + slice - 1 + (sign > 0 ? 1 : 0);
        cell[u] = origin[u] + i + cornerU * width;
        cell[v] = origin[v] + j + cornerV * height;

        const [tu, tv] = direction.uv(cell);
        const shade = SHADES[shades[index]];

        out.positions.push(cell[0] / ZoneData.CUBES_PER_METRE - frame.half, (cell[1] - frame.base) / ZoneData.CUBES_PER_METRE, cell[2] / ZoneData.CUBES_PER_METRE - frame.half);
        out.normals.push(...normal);
        out.uvs.push(tu * frame.perCell, tv * frame.perCell);
        out.layers.push(layer);
        out.colours.push(shade, shade, shade);
    });

    out.indices.push(...triangles(shades, (v === (u + 1) % 3) === (sign > 0)).map((index) => first + index));
}

// The corners run anticlockwise seen from the side the face points to when
// u x v points along the face's normal. The quad splits along the diagonal
// between its darker corners.
function triangles(shades, isAnticlockwise)
{
    const order = shades[0] + shades[2] < shades[1] + shades[3] ? [1, 2, 3, 1, 3, 0] : [0, 1, 2, 0, 2, 3];

    return isAnticlockwise ? order : [order[0], order[2], order[1], order[3], order[5], order[4]];
}
