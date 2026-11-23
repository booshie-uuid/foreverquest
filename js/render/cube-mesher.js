import * as RegionCodec from "../sim/region-codec.js";
import * as THREE from "three";
import { ZoneData } from "../sim/zone-data.js";

const { CHUNK } = RegionCodec;
const PADDED = CHUNK + 2;
const BEDROCK = 255;

// Corners run counter-clockwise seen from outside, and UVs are in world
// cells.
const FACES =
[
    { normal: [1, 0, 0], corners: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], uv: (x, y, z) => [-(z + 1), y, -z, y + 1], side: "side" },
    { normal: [-1, 0, 0], corners: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], uv: (x, y, z) => [z, y, z + 1, y + 1], side: "side" },
    { normal: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], uv: (x, y) => [x, y, x + 1, y + 1], side: "side" },
    { normal: [0, 0, -1], corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], uv: (x, y) => [-(x + 1), y, -x, y + 1], side: "side" },
    { normal: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], uv: (x, y, z) => [x, -(z + 1), x + 1, -z], side: "top" },
    { normal: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], uv: (x, y, z) => [x, z, x + 1, z + 1], side: "bottom" },
];


/******************************************************************************/
/* FACE TABLE                                                                 */
/******************************************************************************/

export function faceTable(blocks, atlas)
{
    const count = blocks.count + 1;
    const table = { top: new Int16Array(count), side: new Int16Array(count), bottom: new Int16Array(count), opaque: new Uint8Array(256), kind: [] };

    for(let number = 1; number < count; number++)
    {
        const block = blocks.block(number);

        for(const side of ["top", "side", "bottom"]) { table[side][number] = atlas.layer(block.faces[side]); }

        table.opaque[number] = blocks.isOpaque(number) ? 1 : 0;
        table.kind[number] = block.kind;
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
    const cells = padded(zone, cx, cy, cz);
    const out = { positions: [], normals: [], uvs: [], layers: [], indices: [] };
    const perCell = atlas.uvPerMetre / ZoneData.CUBES_PER_METRE;
    const origin = [cx * CHUNK, cy * CHUNK, cz * CHUNK];

    for(let y = 1; y <= CHUNK; y++)
    {
        for(let z = 1; z <= CHUNK; z++)
        {
            for(let x = 1; x <= CHUNK; x++)
            {
                const block = cells[(y * PADDED + z) * PADDED + x];

                if(block === 0 || table.kind[block] === "liquid") { continue; }

                FACES.forEach((face) =>
                {
                    const [dx, dy, dz] = face.normal;
                    const neighbour = cells[((y + dy) * PADDED + z + dz) * PADDED + x + dx];

                    if(table.opaque[neighbour] === 1) { return; }
                    if(table.kind[block] === "clear" && neighbour === block) { return; }

                    addFace(out, zone, face, origin[0] + x - 1, origin[1] + y - 1, origin[2] + z - 1, table[face.side][block], perCell);
                });
            }
        }
    }

    if(out.indices.length === 0) { return null; }

    const geometry = new THREE.BufferGeometry();

    geometry.setAttribute("position", new THREE.Float32BufferAttribute(out.positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(out.normals, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(out.uvs, 2));
    geometry.setAttribute("layer", new THREE.Float32BufferAttribute(out.layers, 1));
    geometry.setIndex(out.indices);
    geometry.computeBoundingSphere();

    return geometry;
}

// Cells below the zone count as solid.
function padded(zone, cx, cy, cz)
{
    const cells = new Uint8Array(PADDED * PADDED * PADDED);
    const [left, bottom, back] = [cx * CHUNK - 1, cy * CHUNK - 1, cz * CHUNK - 1];

    for(let y = 0; y < PADDED; y++)
    {
        for(let z = 0; z < PADDED; z++)
        {
            for(let x = 0; x < PADDED; x++)
            {
                const cellY = bottom + y;

                cells[(y * PADDED + z) * PADDED + x] = cellY < 0 ? BEDROCK : zone.blockAt(left + x, cellY, back + z);
            }
        }
    }

    return cells;
}

function addFace(out, zone, face, x, y, z, layer, perCell)
{
    const first = out.positions.length / 3;
    const [u0, v0, u1, v1] = face.uv(x, y, z);
    const cornerUvs = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];

    face.corners.forEach(([ox, oy, oz], i) =>
    {
        out.positions.push((x + ox) / ZoneData.CUBES_PER_METRE - zone.half, (y + oy - zone.base) / ZoneData.CUBES_PER_METRE, (z + oz) / ZoneData.CUBES_PER_METRE - zone.half);
        out.normals.push(...face.normal);
        out.uvs.push(cornerUvs[i][0] * perCell, cornerUvs[i][1] * perCell);
        out.layers.push(layer);
    });

    out.indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
}
