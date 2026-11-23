import * as WorldTextures from "../../content/world-textures.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

const CONTENT = path.resolve(import.meta.dirname, "..", "..", "content", "objects");
const ID_PATTERN = /^[a-z][A-Za-z0-9]*$/;
const FINE = 8;
const CUBE = 1 / 3;
const MAX_CELLS = 8;
const MAX_TRIANGLES = 6000;

// Each direction's u and v axes, and its texture coordinates from a corner's
// fine position, as the cube mesher lays them.
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
/* BAKE                                                                       */
/******************************************************************************/

export async function bake(problems, context)
{
    const objects = {};
    const blocks = new Map(context.blocks.map((block) => [block.id, block]));

    for(const file of fs.readdirSync(CONTENT).filter((name) => name.endsWith(".js")).sort())
    {
        const loaded = await import(url.pathToFileURL(path.join(CONTENT, file)).href);

        for(const [id, object] of Object.entries(loaded.OBJECTS ?? {}))
        {
            const where = "Object " + id + " in objects/" + file;

            if(objects[id]) { problems.push(where + " is listed twice"); continue; }

            const baked = bakeObject(id, object, blocks, where, problems);

            if(baked) { objects[id] = baked; }
        }
    }

    context.objects = objects;

    return {
        files: [{ path: "objects.json", bytes: Buffer.from(JSON.stringify(objects) + "\n") }],
        ids: { object: Object.keys(objects) },
    };
}

export function bakeObject(id, object, blocks, where, problems)
{
    const before = problems.length;
    const cells = object.cells;

    if(!ID_PATTERN.test(id)) { problems.push(where + " has an invalid id"); }
    if(!(Array.isArray(cells) && cells.length === 3 && cells.every((count) => Number.isInteger(count) && count >= 1 && count <= MAX_CELLS)))
    {
        problems.push(where + " needs cells: three whole numbers of cubes from 1 to " + MAX_CELLS);
        return null;
    }

    const grid = new FineGrid(cells, blocks, where, problems);

    object.build(grid);

    if(grid.count === 0) { problems.push(where + " has no fine cubes"); }
    if(problems.length > before) { return null; }

    const mesh = meshGrid(grid, blocks);

    if(mesh.indices.length / 3 > MAX_TRIANGLES) { problems.push(where + " has " + mesh.indices.length / 3 + " triangles, more than " + MAX_TRIANGLES); }

    return { cells, isSolid: object.isSolid !== false, ...mesh };
}


/******************************************************************************/
/* FINE GRID                                                                  */
/******************************************************************************/

// A fine cube outside the object's cubes is a problem.
export class FineGrid
{
    constructor(cells, blocks, where, problems)
    {
        this.size = cells.map((count) => count * FINE);
        this.blocks = blocks;
        this.where = where;
        this.problems = problems;
        this.palette = [null];
        this.data = new Uint8Array(this.size[0] * this.size[1] * this.size[2]);
        this.count = 0;
    }

    set(x, y, z, id)
    {
        const [width, height, depth] = this.size;

        if(![x, y, z].every(Number.isInteger)) { this.problem("places a fine cube at a position that is not whole: " + [x, y, z].join(", ")); return; }
        if(x < 0 || y < 0 || z < 0 || x >= width || y >= height || z >= depth) { this.problem("places a fine cube outside its cubes at " + [x, y, z].join(", ")); return; }
        if(!this.blocks.has(id) || this.blocks.get(id).kind === "object") { this.problem("uses an unknown block: " + id); return; }

        let index = this.palette.indexOf(id);

        if(index < 0)
        {
            this.palette.push(id);
            index = this.palette.length - 1;
        }

        const at = (y * depth + z) * width + x;

        if(this.data[at] === 0) { this.count++; }

        this.data[at] = index;
    }

    // Fills from one corner up to, not including, the other.
    box(from, to, id)
    {
        for(let y = from[1]; y < to[1]; y++)
        {
            for(let z = from[2]; z < to[2]; z++)
            {
                for(let x = from[0]; x < to[0]; x++) { this.set(x, y, z, id); }
            }
        }
    }

    get(x, y, z)
    {
        const [width, height, depth] = this.size;

        if(x < 0 || y < 0 || z < 0 || x >= width || y >= height || z >= depth) { return 0; }

        return this.data[(y * depth + z) * width + x];
    }

    problem(text)
    {
        if(this.problems.some((entry) => entry.startsWith(this.where))) { return; }

        this.problems.push(this.where + " " + text);
    }
}


/******************************************************************************/
/* MESH                                                                       */
/******************************************************************************/

// The mesh is in metres from the object's lower corner.
export function meshGrid(grid, blocks)
{
    const textures = [];
    const out = { positions: [], normals: [], uvs: [], layers: [], indices: [] };
    const perFine = (WorldTextures.TEXELS_PER_METRE / WorldTextures.SIZE) * (CUBE / FINE);
    const textureOf = (paletteIndex, side) =>
    {
        const name = blocks.get(grid.palette[paletteIndex]).faces[side];

        if(!textures.includes(name)) { textures.push(name); }

        return textures.indexOf(name);
    };

    for(const direction of DIRECTIONS)
    {
        const { axis, sign, u, v } = direction;
        const [sizeU, sizeV] = [grid.size[u], grid.size[v]];
        const mask = new Int32Array(sizeU * sizeV);

        for(let slice = 0; slice < grid.size[axis]; slice++)
        {
            for(let j = 0; j < sizeV; j++)
            {
                for(let i = 0; i < sizeU; i++)
                {
                    const at = [0, 0, 0];

                    at[axis] = slice;
                    at[u] = i;
                    at[v] = j;

                    const filled = grid.get(...at);

                    at[axis] += sign;
                    mask[j * sizeU + i] = filled !== 0 && grid.get(...at) === 0 ? textureOf(filled, direction.side) + 1 : 0;
                }
            }

            merge(out, mask, direction, slice, [sizeU, sizeV], perFine);
        }
    }

    return { textures, positions: out.positions.map(round), normals: out.normals, uvs: out.uvs.map(round), layers: out.layers, indices: out.indices };
}

function merge(out, mask, direction, slice, [sizeU, sizeV], perFine)
{
    for(let j = 0; j < sizeV; j++)
    {
        for(let i = 0; i < sizeU;)
        {
            const key = mask[j * sizeU + i];

            if(key === 0)
            {
                i++;
                continue;
            }

            let width = 1;
            let height = 1;

            while(i + width < sizeU && mask[j * sizeU + i + width] === key) { width++; }
            while(j + height < sizeV && rowMatches(mask, key, i, j + height, width, sizeU)) { height++; }

            for(let row = j; row < j + height; row++) { mask.fill(0, row * sizeU + i, row * sizeU + i + width); }

            addQuad(out, direction, key - 1, [slice, i, j, width, height], perFine);
            i += width;
        }
    }
}

function rowMatches(mask, key, i, j, width, sizeU)
{
    for(let k = i; k < i + width; k++) { if(mask[j * sizeU + k] !== key) { return false; } }

    return true;
}

function addQuad(out, direction, texture, [slice, i, j, width, height], perFine)
{
    const { axis, sign, u, v } = direction;
    const first = out.positions.length / 3;
    const normal = [0, 0, 0];

    normal[axis] = sign;

    for(const [cornerU, cornerV] of [[0, 0], [1, 0], [1, 1], [0, 1]])
    {
        const corner = [0, 0, 0];

        corner[axis] = slice + (sign > 0 ? 1 : 0);
        corner[u] = i + cornerU * width;
        corner[v] = j + cornerV * height;

        const [tu, tv] = direction.uv(corner);

        out.positions.push(...corner.map((value) => (value / FINE) * CUBE));
        out.normals.push(...normal);
        out.uvs.push(tu * perFine, tv * perFine);
        out.layers.push(texture);
    }

    const order = (v === (u + 1) % 3) === (sign > 0) ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];

    out.indices.push(...order.map((index) => first + index));
}

function round(value)
{
    return Math.round(value * 1e6) / 1e6;
}
