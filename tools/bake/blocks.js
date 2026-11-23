import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

const CONTENT = path.resolve(import.meta.dirname, "..", "..", "content", "blocks");
const ID_PATTERN = /^[a-z][A-Za-z0-9]*$/;
const KINDS = ["solid", "clear", "liquid", "object"];
const FACES = ["all", "top", "side", "bottom"];
const MAX_LIGHT = 15;
const WEATHERS = ["moss", "grime", "cracks", "chips"];


/******************************************************************************/
/* BAKE                                                                       */
/******************************************************************************/

export async function bake(problems, context)
{
    const blocks = [];

    for(const file of fs.readdirSync(CONTENT).filter((name) => name.endsWith(".js")).sort())
    {
        const loaded = await import(url.pathToFileURL(path.join(CONTENT, file)).href);

        for(const [id, block] of Object.entries(loaded.BLOCKS ?? {}))
        {
            const where = "Block " + id + " in blocks/" + file;

            if(blocks.some((entry) => entry.id === id)) { problems.push(where + " is listed twice"); continue; }

            const baked = bakeBlock(id, block, context.worldTextures, where, problems);

            if(baked) { blocks.push(baked); }
        }
    }

    context.blocks = blocks;

    return {
        files: [{ path: "blocks.json", bytes: Buffer.from(JSON.stringify(blocks, null, 4) + "\n") }],
        ids: { block: blocks.map((block) => block.id) },
    };
}

export function bakeBlock(id, block, textures, where, problems)
{
    const before = problems.length;
    const kind = block.kind ?? "solid";
    const light = block.light ?? 0;
    const faces = block.faces ?? {};
    const weathers = block.weathers ?? [];

    if(!ID_PATTERN.test(id)) { problems.push(where + " has an invalid id"); }
    if(!KINDS.includes(kind)) { problems.push(where + " has an unknown kind: " + kind); }
    if(!(Number.isInteger(light) && light >= 0 && light <= MAX_LIGHT)) { problems.push(where + " needs a light from 0 to " + MAX_LIGHT); }

    for(const [face, texture] of Object.entries(faces))
    {
        if(!FACES.includes(face)) { problems.push(where + " has an unknown face: " + face); }
        if(!textures.includes(texture)) { problems.push(where + " paints an unknown world texture: " + texture); }
    }

    const top = faces.top ?? faces.all;
    const side = faces.side ?? faces.all;
    const bottom = faces.bottom ?? faces.all;

    if(kind !== "object" && !(top && side && bottom)) { problems.push(where + " needs a texture for its top, sides and bottom"); }
    if(!(weathers.every((weather) => WEATHERS.includes(weather)) && (kind === "solid" || weathers.length === 0))) { problems.push(where + " weathers in an unknown way, or is not solid: " + weathers.join(", ")); }
    if(block.worn !== undefined && !textures.includes(block.worn)) { problems.push(where + " wears to an unknown world texture: " + block.worn); }
    if(problems.length > before) { return null; }

    if(kind === "object") { return { id, kind, light, faces: {} }; }

    return { id, kind, light, faces: { top, side, bottom }, weathers, ...(block.worn ? { worn: block.worn } : {}) };
}
