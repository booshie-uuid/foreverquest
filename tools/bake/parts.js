import * as Appearance from "../../content/appearance.js";
import * as Archetypes from "../../content/archetypes.js";
import * as Layers from "./layers.js";
import * as Models from "./models.js";
import * as Palettes from "../../content/palettes.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

const FOLDER = path.resolve(import.meta.dirname, "..", "..", "content", "parts");
const ID_PATTERN = /^[A-Za-z0-9]+$/;
const FACES = ["front", "back", "left", "right", "top", "bottom"];


/******************************************************************************/
/* BAKE                                                                       */
/******************************************************************************/

export async function bake(problems, context)
{
    context.seen = new Set();

    const parts = [];
    const json = (value) => Buffer.from(JSON.stringify(value, null, 4) + "\n");

    for(const source of await load())
    {
        const part = compilePart(source, context, problems);

        if(part) { parts.push(part); }
    }

    for(const rig of context.rigs.values())
    {
        for(const layer of rig.base) { Layers.check(layer, rig, context.stamps, "Rig " + rig.id + " base layer", problems, true); }
    }

    for(const body of context.bodies)
    {
        for(const feature of body.features)
        {
            if(!parts.some((part) => part.slot === "feature" && part.id === feature)) { problems.push("Body " + body.id + " has an unknown feature: " + feature); }
        }
    }

    parts.sort((a, b) => a.slot.localeCompare(b.slot) || a.order - b.order || a.id.localeCompare(b.id));
    checkCatalogue(parts, context, problems);

    const ids = parts.map((part) => part.slot + "/" + part.id);
    const files =
    [
        { path: "models/parts/index.json", bytes: json(ids) },
        { path: "models/palettes.json", bytes: json(Palettes.PALETTES) },
        { path: "models/archetypes.json", bytes: json(Archetypes.ARCHETYPES) },
        { path: "models/appearance.json", bytes: json({ defaults: Appearance.DEFAULTS, random: Appearance.RANDOM }) },
    ];

    for(const part of parts) { files.push({ path: "models/parts/" + part.slot + "/" + part.id + ".json", bytes: json(part) }); }

    return { files, ids: { part: ids } };
}

async function load()
{
    const found = [];

    for(const slot of fs.readdirSync(FOLDER, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort())
    {
        for(const file of fs.readdirSync(path.join(FOLDER, slot)).filter((name) => name.endsWith(".js")).sort())
        {
            const loaded = await import(url.pathToFileURL(path.join(FOLDER, slot, file)).href);

            for(const part of loaded.PARTS ?? (loaded.PART ? [loaded.PART] : []))
            {
                found.push({ ...part, file: "parts/" + slot + "/" + file, folder: slot });
            }
        }
    }

    return found;
}


/******************************************************************************/
/* PARTS                                                                      */
/******************************************************************************/

export function compilePart(source, context, problems)
{
    const where = "Part " + source.file;
    const before = problems.length;
    const rigs = [...context.rigs.values()].filter((rig) => rig.slots.includes(source.slot));

    if(!ID_PATTERN.test(source.id ?? "")) { problems.push(where + " has an invalid id: " + source.id); }
    if(context.seen.has(source.slot + "/" + source.id)) { problems.push(where + " repeats the part " + source.slot + "/" + source.id); }

    context.seen.add(source.slot + "/" + source.id);
    if(source.folder && source.folder !== source.slot) { problems.push(where + " is for the " + source.slot + " slot but sits in the " + source.folder + " folder"); }
    if(rigs.length === 0) { problems.push(where + " is for a slot that no rig offers: " + source.slot); return null; }

    const boxes = [...new Set(rigs.flatMap((rig) => rig.boxes))];
    const blocks = (source.blocks ?? []).map((block, i) => compileBlock(block, rigs, boxes, context, where + " block " + i, problems));

    for(const layer of source.paint ?? [])
    {
        for(const rig of rigs) { Layers.check(layer, rig, context.stamps, where + " layer on " + layer.region, problems, true); }
    }

    checkTints(source, where, problems);

    if(problems.length > before) { return null; }

    return {
        id: source.id,
        slot: source.slot,
        name: source.name ?? source.id,
        order: source.order ?? 0,
        tints: source.tints ?? {},
        colour: source.colour ?? null,
        trimColour: source.trimColour ?? null,
        hidesHair: source.hidesHair === true,
        stance: source.stance ?? null,
        paint: (source.paint ?? []).map(Layers.normalise),
        blocks,
    };
}

function checkTints(source, where, problems)
{
    for(const [field, defaultField] of [["primary", "colour"], ["trim", "trimColour"]])
    {
        const palette = source.tints?.[field];

        if(palette === undefined) { continue; }
        if(!Palettes.PALETTES[palette]) { problems.push(where + " uses an unknown palette: " + palette); continue; }
        if(!Palettes.PALETTES[palette].includes(source[defaultField])) { problems.push(where + " needs a default " + field + " colour from the " + palette + " palette"); }
    }
}

function checkCatalogue(parts, context, problems)
{
    const has = (slot, id) => parts.some((part) => part.slot === slot && part.id === id);
    const defaults = Appearance.DEFAULTS;

    for(const slot of ["face", "nose", "hair", "beard", "markings"])
    {
        if(!has(slot, defaults[slot])) { problems.push("The default " + slot + " is not a part: " + defaults[slot]); }
    }

    for(const [slot, id] of Object.entries(defaults.equipment))
    {
        if(!has(slot, id)) { problems.push("The default " + slot + " gear is not a part: " + id); }
    }

    for(const archetype of Archetypes.ARCHETYPES)
    {
        for(const [slot, ids] of Object.entries(archetype.slots))
        {
            for(const id of ids.filter((entry) => !has(slot, entry))) { problems.push("Archetype " + archetype.id + " names a " + slot + " part that does not exist: " + id); }
        }
    }

    const rules = [Appearance.RANDOM, ...context.bodies.map((body) => body.random)];

    for(const rule of rules)
    {
        for(const id of [...(rule.hair?.female ?? []), ...(rule.hair?.male ?? [])].filter((entry) => !has("hair", entry))) { problems.push("A random hair rule names an unknown style: " + id); }
        for(const id of (rule.beard?.from ?? []).filter((entry) => !has("beard", entry))) { problems.push("A random beard rule names an unknown beard: " + id); }
    }

    for(const [name, colours] of Object.entries(Palettes.PALETTES))
    {
        if(!colours.every((colour) => /^#[0-9a-f]{6}$/.test(colour))) { problems.push("The " + name + " palette needs lower-case #rrggbb colours"); }
    }
}

function compileBlock(block, rigs, boxes, context, where, problems)
{
    const point = (values, name) =>
    {
        if(!Array.isArray(values) || values.length !== 3) { problems.push(where + " needs a " + name + " of three values"); return []; }

        return values.map((value) => Models.compile(value, boxes, where, problems));
    };

    for(const rig of rigs)
    {
        for(const target of [block.at, block.mirror].filter(Boolean))
        {
            const isKnown = rig.bones.some((bone) => bone.name === target) || rig.sockets.some((socket) => socket.name === target);

            if(!isKnown) { problems.push(where + " attaches to " + target + ", which the " + rig.id + " rig does not have"); }
        }

        for(const [face, layers] of Object.entries(block.faces ?? {}))
        {
            if(face !== "all" && !FACES.includes(face)) { problems.push(where + " paints an unknown face: " + face); }

            for(const layer of layers) { Layers.check(layer, rig, context.stamps, where + " " + face + " face", problems, false); }
        }
    }

    if(!block.faces?.all && !FACES.every((face) => block.faces?.[face])) { problems.push(where + " must paint every face, or give an all list"); }

    return {
        at: block.at,
        mirror: block.mirror ?? null,
        size: point(block.size, "size"),
        centre: point(block.centre, "centre"),
        rotation: block.rotation ?? null,
        faces: Object.fromEntries(Object.entries(block.faces ?? {}).map(([face, layers]) => [face, layers.map(Layers.normalise)])),
    };
}
