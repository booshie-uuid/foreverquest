import * as RegionCodec from "../sim/region-codec.js";
import { ZoneData } from "../sim/zone-data.js";

const { CHUNK } = RegionCodec;
const MARGIN = 15;
const PADDED = CHUNK + MARGIN * 2;
const BEDROCK = 255;
const MAX_LIGHT = 15;
const SHADES = [1, 0.84, 0.72, 0.6];
const CORNERS = [[0, 0], [1, 0], [1, 1], [0, 1]];

// The step through the padded cells along x, y and z.
const STRIDES = [1, PADDED * PADDED, PADDED];

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

export const PADDING = MARGIN;


/******************************************************************************/
/* FACE TABLE                                                                 */
/******************************************************************************/

export function faceTable(blocks, atlas)
{
    const count = blocks.count + 1;
    const flags = () => new Uint8Array(256);
    const table = { top: new Int16Array(count), side: new Int16Array(count), bottom: new Int16Array(count), opaque: flags(), clear: flags(), liquid: flags(), hidden: flags(), standable: flags(), lights: flags() };

    for(let number = 1; number < count; number++)
    {
        const block = blocks.block(number);

        for(const side of ["top", "side", "bottom"]) { table[side][number] = block.faces[side] ? atlas.layer(block.faces[side]) : 0; }

        table.opaque[number] = block.kind === "solid" ? 1 : 0;
        table.clear[number] = block.kind === "clear" ? 1 : 0;
        table.liquid[number] = block.kind === "liquid" ? 1 : 0;
        table.hidden[number] = block.kind === "liquid" || block.kind === "object" ? 1 : 0;
        table.standable[number] = block.kind === "solid" || block.kind === "clear" || block.kind === "object" ? 1 : 0;
        table.lights[number] = block.light;
    }

    table.opaque[BEDROCK] = 1;

    return table;
}


/******************************************************************************/
/* CELLS                                                                      */
/******************************************************************************/

// The chunk's cells with a border of MARGIN cells from its neighbours, in
// (y * PADDED + z) * PADDED + x order, and the surface of each padded column.
// Cells below the zone, and in regions not loaded, count as solid.
export function paddedCells(zone, cx, cy, cz)
{
    const cells = new Uint8Array(PADDED * PADDED * PADDED);
    const surfaces = new Uint16Array(PADDED * PADDED);
    const left = cx * CHUNK - MARGIN;
    const bottom = cy * CHUNK - MARGIN;
    const back = cz * CHUNK - MARGIN;

    for(let dy = -1; dy <= 1; dy++)
    {
        for(let dz = -1; dz <= 1; dz++)
        {
            for(let dx = -1; dx <= 1; dx++) { copyChunk(zone, cells, [cx + dx, cy + dy, cz + dz], [left, bottom, back]); }
        }
    }

    for(let z = 0; z < PADDED; z++)
    {
        for(let x = 0; x < PADDED; x++) { surfaces[z * PADDED + x] = zone.surface(left + x, back + z); }
    }

    return { cells, surfaces, bottom };
}

function copyChunk(zone, cells, [cx, cy, cz], [left, bottom, back])
{
    const isOutside = cx < 0 || cz < 0 || cx >= zone.chunksWide || cz >= zone.chunksWide;
    const isUnknown = cy < 0 || (!isOutside && !zone.isColumnLoaded(cx * CHUNK, cz * CHUNK));
    const chunk = isOutside || isUnknown ? null : zone.chunkAt(cx, cy, cz);
    const low = [cx * CHUNK, cy * CHUNK, cz * CHUNK].map((start, axis) => Math.max(start, [left, bottom, back][axis]));
    const high = [cx * CHUNK, cy * CHUNK, cz * CHUNK].map((start, axis) => Math.min(start + CHUNK, [left, bottom, back][axis] + PADDED));

    if(low.some((value, axis) => value >= high[axis])) { return; }

    for(let y = low[1]; y < high[1]; y++)
    {
        for(let z = low[2]; z < high[2]; z++)
        {
            const to = ((y - bottom) * PADDED + (z - back)) * PADDED - left;

            for(let x = low[0]; x < high[0]; x++)
            {
                let block = 0;

                if(isUnknown) { block = BEDROCK; }
                else if(chunk) { block = chunk.cells === null ? chunk.uniform : chunk.cells[((y - cy * CHUNK) * CHUNK + (z - cz * CHUNK)) * CHUNK + (x - cx * CHUNK)]; }

                cells[to + x] = block;
            }
        }
    }
}


/******************************************************************************/
/* LIGHT                                                                      */
/******************************************************************************/

// Each cell's sky light in the high four bits and lamp light in the low four.
// Sky light is MAX_LIGHT above a column's surface; both spread through cells
// that are not opaque, one level dimmer a cell.
export function lightCells(volume, table)
{
    const { cells, surfaces, bottom } = volume;
    const sky = new Uint8Array(cells.length);
    const lamp = new Uint8Array(cells.length);
    const skySeeds = [];
    const lampSeeds = [];

    for(let z = 0; z < PADDED; z++)
    {
        for(let x = 0; x < PADDED; x++)
        {
            const open = Math.max(0, surfaces[z * PADDED + x] - bottom);

            for(let y = open; y < PADDED; y++) { sky[(y * PADDED + z) * PADDED + x] = MAX_LIGHT; }

            for(const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
            {
                const nx = x + dx;
                const nz = z + dz;

                if(nx < 0 || nz < 0 || nx >= PADDED || nz >= PADDED) { continue; }

                const covered = Math.min(PADDED, surfaces[nz * PADDED + nx] - bottom);

                for(let y = open; y < covered; y++) { skySeeds.push((y * PADDED + z) * PADDED + x); }
            }
        }
    }

    for(let i = 0; i < cells.length; i++)
    {
        const level = table.lights[cells[i]];

        if(level > 0)
        {
            lamp[i] = level;
            lampSeeds.push(i);
        }
    }

    spread(sky, skySeeds, cells, table.opaque);
    spread(lamp, lampSeeds, cells, table.opaque);

    const light = new Uint8Array(cells.length);

    for(let i = 0; i < light.length; i++) { light[i] = (sky[i] << 4) | lamp[i]; }

    return light;
}

// Breadth first, so each cell keeps the brightest level that reaches it.
function spread(levels, seeds, cells, opaque)
{
    let queue = new Int32Array(Math.max(1024, seeds.length * 2));
    let head = 0;
    let tail = seeds.length;

    queue.set(seeds);

    const visit = (neighbour, next) =>
    {
        if(opaque[cells[neighbour]] === 1 || levels[neighbour] >= next) { return; }

        levels[neighbour] = next;

        if(tail === queue.length)
        {
            const grown = new Int32Array(queue.length * 2);

            grown.set(queue);
            queue = grown;
        }

        queue[tail++] = neighbour;
    };

    while(head < tail)
    {
        const index = queue[head++];
        const next = levels[index] - 1;

        if(next <= 0) { continue; }

        const x = index % PADDED;
        const z = Math.floor(index / PADDED) % PADDED;
        const y = Math.floor(index / (PADDED * PADDED));

        if(x > 0) { visit(index - 1, next); }
        if(x < PADDED - 1) { visit(index + 1, next); }
        if(z > 0) { visit(index - PADDED, next); }
        if(z < PADDED - 1) { visit(index + PADDED, next); }
        if(y > 0) { visit(index - PADDED * PADDED, next); }
        if(y < PADDED - 1) { visit(index + PADDED * PADDED, next); }
    }
}


/******************************************************************************/
/* MESH                                                                       */
/******************************************************************************/

// Returns null for a chunk with no visible face. Liquids are left to the
// water view.
export function buildChunk(zone, table, atlas, cx, cy, cz)
{
    const frame = { half: zone.half, base: zone.base, perCell: atlas.uvPerMetre / ZoneData.CUBES_PER_METRE };

    return meshCells(paddedCells(zone, cx, cy, cz), table, [cx * CHUNK, cy * CHUNK, cz * CHUNK], frame);
}

export function meshCells(volume, table, origin, frame)
{
    const out = { positions: [], normals: [], uvs: [], layers: [], colours: [], lights: [], indices: [] };
    const mask = new Int32Array(CHUNK * CHUNK);
    const light = lightCells(volume, table);
    const floors = floorLights(volume.cells, light, table);

    for(const direction of DIRECTIONS)
    {
        for(let slice = 0; slice < CHUNK; slice++)
        {
            if(fillMask(mask, volume.cells, light, table, direction, slice)) { mergeMask(out, mask, direction, slice, origin, frame); }
        }
    }

    if(out.indices.length === 0) { return { floors }; }

    return {
        floors,
        positions: new Float32Array(out.positions),
        normals: new Float32Array(out.normals),
        uvs: new Float32Array(out.uvs),
        layers: new Float32Array(out.layers),
        colours: new Float32Array(out.colours),
        lights: new Float32Array(out.lights),
        indices: new Uint32Array(out.indices),
    };
}

// Each cube of the chunk that something can stand on, by its index in the
// chunk, ascending, with the light of the cell above it.
function floorLights(cells, light, table)
{
    const indices = [];
    const levels = [];
    const above = PADDED * PADDED;

    for(let y = 0; y < CHUNK; y++)
    {
        for(let z = 0; z < CHUNK; z++)
        {
            for(let x = 0; x < CHUNK; x++)
            {
                const index = ((y + MARGIN) * PADDED + z + MARGIN) * PADDED + x + MARGIN;
                const isFloor = table.standable[cells[index]] && !table.standable[cells[index + above]];

                if(!isFloor) { continue; }

                indices.push((y * CHUNK + z) * CHUNK + x);
                levels.push(light[index + above]);
            }
        }
    }

    return { indices: Uint16Array.from(indices), levels: Uint8Array.from(levels) };
}

/* MASK ***********************************************************************/

// A mask entry is 0 for no face, or the face's layer + 1, then the light of
// the cell in front of it, then its four corner shades of two bits each.
function fillMask(mask, cells, light, table, direction, slice)
{
    const { axis, sign, u, v, side } = direction;
    const [stepU, stepV, stepAxis] = [STRIDES[u], STRIDES[v], STRIDES[axis]];
    const layers = table[side];
    let hasFace = false;

    for(let j = 0; j < CHUNK; j++)
    {
        let index = (slice + MARGIN) * stepAxis + MARGIN * stepU + (j + MARGIN) * stepV;

        for(let i = 0; i < CHUNK; i++, index += stepU)
        {
            const block = cells[index];
            const front = index + sign * stepAxis;
            const neighbour = cells[front];
            const isHidden = block === 0 || table.hidden[block] === 1 || table.opaque[neighbour] === 1 || (table.clear[block] === 1 && neighbour === block);

            if(isHidden)
            {
                mask[j * CHUNK + i] = 0;
                continue;
            }

            mask[j * CHUNK + i] = ((layers[block] + 1) << 16) | (light[front] << 8) | shadesOf(cells, table.opaque, front, stepU, stepV);
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
    const layer = (key >> 16) - 1;
    const light = (key >> 8) & 0xff;
    const shades = CORNERS.map((corner, index) => (key >> (index * 2)) & 3);
    const normal = [0, 0, 0];

    normal[axis] = sign;

    CORNERS.forEach(([cornerU, cornerV], index) =>
    {
        const cell = [0, 0, 0];

        cell[axis] = origin[axis] + slice + (sign > 0 ? 1 : 0);
        cell[u] = origin[u] + i + cornerU * width;
        cell[v] = origin[v] + j + cornerV * height;

        const [tu, tv] = direction.uv(cell);
        const shade = SHADES[shades[index]];

        out.positions.push(cell[0] / ZoneData.CUBES_PER_METRE - frame.half, (cell[1] - frame.base) / ZoneData.CUBES_PER_METRE, cell[2] / ZoneData.CUBES_PER_METRE - frame.half);
        out.normals.push(...normal);
        out.uvs.push(tu * frame.perCell, tv * frame.perCell);
        out.layers.push(layer);
        out.colours.push(shade, shade, shade);
        out.lights.push((light >> 4) / MAX_LIGHT, (light & 0xf) / MAX_LIGHT);
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
