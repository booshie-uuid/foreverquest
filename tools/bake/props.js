import * as Prefabs from "../../content/props/prefabs.js";
import * as Voxelise from "./voxelise.js";
import * as fs from "node:fs";
import * as path from "node:path";

const FACES = ["front", "back", "left", "right", "top", "bottom"];
const LAYOUTS = path.resolve(import.meta.dirname, "..", "..", "content", "props", "layouts.json");

export function bake(problems, context)
{
    const prefabs = {};
    const layouts = fs.existsSync(LAYOUTS) ? JSON.parse(fs.readFileSync(LAYOUTS, "utf8")) : {};

    for(const id of Object.keys(layouts).filter((name) => !Prefabs.PREFABS[name])) { problems.push("Layouts in props/layouts.json name an unknown prefab: " + id); }

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
