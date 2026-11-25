import * as FineMesher from "../../js/render/fine-mesher.js";
import * as LightColours from "../../content/light-colours.js";
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

    for(const file of fs.readdirSync(CONTENT).filter((name) => name.endsWith(".json")).sort())
    {
        const id = path.basename(file, ".json");
        const where = "Object " + id + " in objects/" + file;
        const baked = bakeData(id, JSON.parse(fs.readFileSync(path.join(CONTENT, file), "utf8")), blocks, where, problems);

        if(baked) { objects[id] = baked; }
    }

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

    return finish(object, grid, blocks, where, problems, before);
}

// An object saved as data holds its `cells`, `palette` and `runs` as the
// bake writes them, with `isSolid`, `lights` and `glow` as a coded object
// gives them.
export function bakeData(id, data, blocks, where, problems)
{
    const before = problems.length;
    const cells = data.cells;
    const isGrid = Array.isArray(cells) && cells.length === 3 && cells.every((count) => Number.isInteger(count) && count >= 1 && count <= MAX_CELLS);

    if(!ID_PATTERN.test(id)) { problems.push(where + " has an invalid id"); }

    if(!isGrid || !Array.isArray(data.palette) || !Array.isArray(data.runs))
    {
        problems.push(where + " needs cells, three whole numbers of cubes from 1 to " + MAX_CELLS + ", a palette and runs");
        return null;
    }

    const grid = FineMesher.decode(data);
    const total = data.runs.reduce((sum, value, i) => sum + (i % 2 === 1 ? value : 0), 0);

    for(const block of data.palette.slice(1))
    {
        if(!blocks.has(block) || blocks.get(block).kind === "object") { problems.push(where + " uses an unknown block: " + block); }
    }

    if(data.palette[0] !== null) { problems.push(where + " needs null as the first entry of its palette"); }
    if(total !== grid.data.length || data.runs.some((value, i) => i % 2 === 0 && !(value >= 0 && value < data.palette.length))) { problems.push(where + " has runs that do not fill its " + cells.join(" × ") + " cubes from its palette"); }

    grid.count = grid.data.reduce((count, value) => count + (value > 0 ? 1 : 0), 0);

    return problems.length > before ? null : finish(data, grid, blocks, where, problems, before);
}

function finish(object, grid, blocks, where, problems, before)
{
    const cells = grid.size.map((size) => size / FineMesher.FINE);

    if(grid.count === 0) { problems.push(where + " has no fine cubes"); }
    if(object.lights !== undefined && !(Array.isArray(object.lights) && object.lights.every((cell) => isCellOf(cell, cells)))) { problems.push(where + " needs its lights to be a list of its cells, each as [x, y, z]"); }
    if(object.glow !== undefined && !(object.lights && LightColours.LIGHT_COLOURS[object.glow])) { problems.push(where + " needs lights and a glow from light-colours.js, not " + object.glow); }
    if(problems.length > before) { return null; }

    const mesh = FineMesher.mesh(grid, (block) => blocks.get(block).faces, WorldTextures.TEXELS_PER_METRE / WorldTextures.SIZE);
    const triangles = mesh.indices.length / 3;

    if(triangles > MAX_TRIANGLES) { problems.push(where + " has " + triangles + " triangles, more than " + MAX_TRIANGLES); }

    const baked = { cells, isSolid: object.isSolid !== false, palette: grid.palette, runs: FineMesher.encode(grid.data) };

    if(object.lights) { baked.lights = object.lights; }
    if(object.glow) { baked.glow = object.glow; }

    return baked;
}

function isCellOf(cell, cells)
{
    return Array.isArray(cell) && cell.length === 3 && cell.every((value, axis) => Number.isInteger(value) && value >= 0 && value < cells[axis]);
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
