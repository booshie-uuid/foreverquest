import * as FineMesher from "../../js/render/fine-mesher.js";
import * as WorldTextures from "../../content/world-textures.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

const CONTENT = path.resolve(import.meta.dirname, "..", "..", "content", "objects");
const ID_PATTERN = /^[a-z][A-Za-z0-9]*$/;
const MAX_CELLS = 8;
const MAX_TRIANGLES = 6000;


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

    const mesh = FineMesher.mesh(grid, (block) => blocks.get(block).faces, WorldTextures.TEXELS_PER_METRE / WorldTextures.SIZE);
    const triangles = mesh.indices.length / 3;

    if(triangles > MAX_TRIANGLES) { problems.push(where + " has " + triangles + " triangles, more than " + MAX_TRIANGLES); }

    return { cells, isSolid: object.isSolid !== false, palette: grid.palette, runs: FineMesher.encode(grid.data) };
}


/******************************************************************************/
/* FINE GRID                                                                  */
/******************************************************************************/

// A fine cube outside the object's cubes is a problem.
export class FineGrid
{
    constructor(cells, blocks, where, problems)
    {
        this.size = cells.map((count) => count * FineMesher.FINE);
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

    problem(text)
    {
        if(this.problems.some((entry) => entry.startsWith(this.where))) { return; }

        this.problems.push(this.where + " " + text);
    }
}
