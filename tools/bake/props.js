import * as Prefabs from "../../content/props/prefabs.js";
import * as Voxelise from "./voxelise.js";
import * as fs from "node:fs";
import * as path from "node:path";

const FACES = ["front", "back", "left", "right", "top", "bottom"];
const LAYOUTS = path.resolve(import.meta.dirname, "..", "..", "content", "props", "layouts.json");
const CAPTURED = path.resolve(import.meta.dirname, "..", "..", "content", "prefabs");
const CUBE = 1 / 3;
const ID_PATTERN = /^[a-z][A-Za-z0-9]*$/;
const MAX_CELLS = 96;

export function bake(problems, context)
{
    const prefabs = {};
    const layouts = fs.existsSync(LAYOUTS) ? JSON.parse(fs.readFileSync(LAYOUTS, "utf8")) : {};

    for(const id of Object.keys(layouts).filter((name) => !Prefabs.PREFABS[name])) { problems.push("Layouts in props/layouts.json name an unknown prefab: " + id); }

    const captured = fs.existsSync(CAPTURED) ? fs.readdirSync(CAPTURED).filter((name) => name.endsWith(".json")).sort() : [];
    const blocks = new Map(context.blocks.map((block) => [block.id, block]));

    for(const file of captured)
    {
        const id = path.basename(file, ".json");
        const where = "Prefab " + id + " in prefabs/" + file;
        const recorded = fromCells(JSON.parse(fs.readFileSync(path.join(CAPTURED, file), "utf8")), blocks, where, problems);

        if(Prefabs.PREFABS[id]) { problems.push(where + " has the id of a prefab in props/prefabs.js"); }
        if(!ID_PATTERN.test(id)) { problems.push(where + " has an invalid id"); }
        if(recorded) { prefabs[id] = recorded; }
    }

    for(const [id, build] of Object.entries(Prefabs.PREFABS))
    {
        const recorded = record(build);

        if(layouts[id] && !Voxelise.areParts(layouts[id])) { problems.push("The layout of prefab " + id + " in props/layouts.json needs parts that map a part number to null or { at, angle, on }"); }
        if(layouts[id]) { recorded.layout = layouts[id]; }

        checkFaces(recorded.blocks, context.worldTextures, "Prefab " + id, problems);

        for(const problem of recorded.problems) { problems.push("Prefab " + id + " " + problem); }

        prefabs[id] = recorded;
    }

    context.prefabs = prefabs;

    return {
        files: [{ path: "props/prefabs.json", bytes: Buffer.from(JSON.stringify(prefabs) + "\n") }],
        ids: { prefab: Object.keys(prefabs) },
    };
}

// A prop function returns a circle, { collider }, or { collider, lights } or
// { collider, light }, with optional `rooms`, `doors` and `clears` boxes
// { size, at }, `objects` it places { object, at, angle } and `problems`, all
// in its own frame when built at the origin.
export function record(build, ...args)
{
    const builder = { blocks: [] };
    const result = build(builder, ...args) ?? {};
    const colliders = Array.isArray(result) ? result : result.collider ? [result.collider] : result.radius !== undefined ? [result] : [];
    const lights = result.lights ?? (result.light ? [result.light] : []);

    return { blocks: builder.blocks, colliders, lights, rooms: result.rooms ?? [], doors: result.doors ?? [], clears: result.clears ?? [], objects: result.objects ?? [], problems: result.problems ?? [] };
}

// A prefab captured from a zone holds its `cells`, [width, height, depth] in
// cubes, with a `palette` of block ids after a first null and `runs` of
// [palette index, count], y then z then x. Each row's runs become blocks of
// one block type each. The origin is the cube corner nearest the middle of
// the bottom, so a quarter turn keeps every cube on the grid.
export function fromCells(data, blocks, where, problems)
{
    const [width, height, depth] = Array.isArray(data.cells) ? data.cells : [];
    const isGrid = [width, height, depth].every((count) => Number.isInteger(count) && count >= 1 && count <= MAX_CELLS);
    const total = (data.runs ?? []).reduce((sum, value, i) => sum + (i % 2 === 1 ? value : 0), 0);

    if(!isGrid || !Array.isArray(data.palette) || data.palette[0] !== null || !Array.isArray(data.runs) || total !== width * height * depth)
    {
        problems.push(where + " needs cells, three whole numbers of cubes from 1 to " + MAX_CELLS + ", a palette that starts with null, and runs that fill its cubes");
        return null;
    }

    const unknown = data.palette.slice(1).filter((id) => !blocks.has(id) || blocks.get(id).kind === "object");

    if(unknown.length > 0)
    {
        problems.push(where + " uses an unknown block: " + unknown.join(", "));
        return null;
    }

    const out = [];
    const [ox, oz] = [Math.floor(width / 2), Math.floor(depth / 2)];
    let at = 0;

    for(let i = 0; i < data.runs.length; i += 2)
    {
        const [entry, count] = [data.runs[i], data.runs[i + 1]];

        for(let left = at; entry > 0 && left < at + count;)
        {
            const x = left % width;
            const length = Math.min(at + count - left, width - x);
            const row = Math.floor(left / width);
            const [y, z] = [Math.floor(row / depth), row % depth];
            const block = blocks.get(data.palette[entry]);

            out.push({ size: [length * CUBE, CUBE, CUBE], at: [(x - ox + length / 2) * CUBE, (y + 0.5) * CUBE, (z - oz + 0.5) * CUBE], block: block.id, faces: facesOf(block) });
            left += length;
        }

        at += count;
    }

    return { blocks: out, colliders: [], lights: [], rooms: [], doors: [], clears: [], objects: [], problems: [], cells: data.cells };
}

function facesOf({ faces })
{
    const side = faces.side ?? faces.all;

    return { front: side, back: side, left: side, right: side, top: faces.top ?? faces.all, bottom: faces.bottom ?? faces.all };
}

export function checkFaces(blocks, textures, where, problems)
{
    for(const block of blocks)
    {
        for(const face of FACES)
        {
            const name = block.faces[face];

            if(name !== null && !textures.includes(name))
            {
                problems.push(where + " paints an unknown world texture: " + name);
                return;
            }
        }
    }
}
