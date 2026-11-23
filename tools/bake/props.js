import * as Prefabs from "../../content/props/prefabs.js";

const FACES = ["front", "back", "left", "right", "top", "bottom"];

export function bake(problems, context)
{
    const prefabs = {};

    for(const [id, build] of Object.entries(Prefabs.PREFABS))
    {
        const recorded = record(build);

        checkFaces(recorded.blocks, context.worldTextures, "Prefab " + id, problems);
        prefabs[id] = recorded;
    }

    context.prefabs = prefabs;

    return {
        files: [{ path: "props/prefabs.json", bytes: Buffer.from(JSON.stringify(prefabs) + "\n") }],
        ids: { prefab: Object.keys(prefabs) },
    };
}

// A prop function returns a circle, { collider }, or { collider, lights } or
// { collider, light }, with optional `rooms` and `doors` boxes { size, at },
// all in its own frame when built at the origin.
export function record(build, ...args)
{
    const builder = { blocks: [] };
    const result = build(builder, ...args) ?? {};
    const colliders = Array.isArray(result) ? result : result.collider ? [result.collider] : result.radius !== undefined ? [result] : [];
    const lights = result.lights ?? (result.light ? [result.light] : []);

    return { blocks: builder.blocks, colliders, lights, rooms: result.rooms ?? [], doors: result.doors ?? [] };
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
