import * as Fitter from "../../js/kit/fitter.js";
import * as Layers from "./layers.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

const CONTENT = path.resolve(import.meta.dirname, "..", "..", "content");
const ID_PATTERN = /^[a-z][A-Za-z0-9]*$/;
const COLOUR_PATTERN = /^#[0-9a-f]{6}$/;
const AXES = { w: 0, h: 1, d: 2 };
const NUMBER = "\\d+(?:\\.\\d+)?";
const TERM = new RegExp("^(?:(" + NUMBER + ")\\*)?([a-z][A-Za-z0-9]*)\\.([whd])(?:/(" + NUMBER + "))?$|^(" + NUMBER + ")$");
const SURFACES = ["outfit", "placeholder"];
const MEASURES = ["radius", "walk", "run", "nameplate", "focus"];
const SLIDER_VALUES = [-1, 1];
const FACES = ["front", "back", "left", "right", "top", "bottom"];


/******************************************************************************/
/* BAKE                                                                       */
/******************************************************************************/

export async function bake(problems, context)
{
    const rigs = new Map();
    const bodies = [];

    for(const source of await loadAll("rigs", "RIG"))
    {
        const rig = compileRig(source, problems);

        if(rig) { rigs.set(rig.id, rig); }
    }

    for(const source of await loadAll("bodies", "BODY"))
    {
        const body = checkBody(source, rigs, problems);

        if(body) { bodies.push(body); }
    }

    bodies.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
    context.rigs = rigs;
    context.bodies = bodies;

    const json = (value) => Buffer.from(JSON.stringify(value, null, 4) + "\n");
    const files = [{ path: "models/index.json", bytes: json({ rigs: [...rigs.keys()].sort(), bodies: bodies.map((body) => body.id) }) }];

    for(const rig of rigs.values()) { files.push({ path: "models/rigs/" + rig.id + ".json", bytes: json(rig) }); }
    for(const body of bodies) { files.push({ path: "models/bodies/" + body.id + ".json", bytes: json(body) }); }

    return {
        files,
        ids:
        {
            "rig": [...rigs.keys()],
            "body": bodies.map((body) => body.id),
            "body-variant": bodies.flatMap((body) => body.variants.map((variant) => body.id + "/" + variant.id)),
        },
    };
}

async function loadAll(folder, exportName)
{
    const directory = path.join(CONTENT, folder);
    const files = fs.readdirSync(directory).filter((file) => file.endsWith(".js")).sort();
    const found = [];

    for(const file of files)
    {
        const loaded = await import(url.pathToFileURL(path.join(directory, file)).href);

        if(loaded[exportName]) { found.push({ ...loaded[exportName], file: folder + "/" + file }); }
    }

    return found;
}


/******************************************************************************/
/* RIGS                                                                       */
/******************************************************************************/

export function compileRig(source, problems)
{
    const where = "Rig " + source.file;
    const before = problems.length;
    const boxes = Array.isArray(source.boxes) ? source.boxes : [];

    if(!ID_PATTERN.test(source.id ?? "")) { problems.push(where + " has an invalid id: " + source.id); }
    if(boxes.length === 0 || new Set(boxes).size !== boxes.length) { problems.push(where + " must list each of its boxes once"); }

    const bones = [];

    for(const bone of source.bones ?? [])
    {
        const definition = bone.mirror ? mirrored(bone, source.bones, where, problems) : bone;

        if(definition) { bones.push(compileBone(definition, boxes, where, problems)); }
    }

    checkHierarchy(bones, where, problems);

    const faceBone = bones.find((bone) => bone.name === source.faceBone);

    if(!faceBone?.box) { problems.push(where + " names a face bone without a box: " + source.faceBone); }

    if(problems.length > before) { return null; }

    return {
        id: source.id,
        boxes,
        faceBone: source.faceBone,
        motion: source.motion ?? null,
        bones,
        sockets: compileSockets(source.sockets ?? [], bones, boxes, where, problems),
        regions: checkRegions(source.regions ?? {}, bones, where, problems),
        slots: source.slots ?? [],
        gear: source.gear ?? [],
        stances: source.stances ?? {},
        base: (source.base ?? []).map(Layers.normalise),
    };
}

function mirrored(bone, all, where, problems)
{
    const original = all.find((entry) => entry.name === bone.mirror && !entry.mirror);

    if(!original)
    {
        problems.push(where + " mirrors a bone it does not have: " + bone.name + " from " + bone.mirror);
        return null;
    }

    const flipX = ([x, y, z]) => [negate(x), y, z];
    const rest = original.rest ?? [0, 0, 0];

    return { ...original, name: bone.name, pivot: flipX(original.pivot), centre: original.centre ? flipX(original.centre) : undefined, rest: [rest[0], -rest[1], -rest[2]] };
}

function negate(expression)
{
    if(typeof expression === "number") { return -expression; }

    return { negate: expression };
}

function compileBone(bone, boxes, where, problems)
{
    const label = where + " bone " + bone.name;

    if(!ID_PATTERN.test(bone.name ?? "")) { problems.push(where + " has a bone with an invalid name: " + bone.name); }
    if(bone.box !== undefined && !boxes.includes(bone.box)) { problems.push(label + " uses an unknown box: " + bone.box); }
    if(Boolean(bone.box) !== Boolean(bone.centre)) { problems.push(label + " needs a centre exactly when it has a box"); }

    const point = (values, name) =>
    {
        if(!Array.isArray(values) || values.length !== 3) { problems.push(label + " needs a " + name + " of three values"); return [linear(0), linear(0), linear(0)]; }

        return values.map((value) => compile(value, boxes, label, problems));
    };

    return {
        name: bone.name,
        parent: bone.parent,
        box: bone.box ?? null,
        pivot: point(bone.pivot, "pivot"),
        centre: bone.box ? point(bone.centre, "centre") : null,
        rest: bone.rest ?? [0, 0, 0],
    };
}

function compileSockets(sockets, bones, boxes, where, problems)
{
    const names = new Set(bones.map((bone) => bone.name));

    return sockets.map((socket) =>
    {
        const label = where + " socket " + socket.name;

        if(!ID_PATTERN.test(socket.name?.replace(".", "") ?? "") || names.has(socket.name)) { problems.push(label + " has an invalid or repeated name"); }
        if(!bones.some((bone) => bone.name === socket.bone)) { problems.push(label + " is on an unknown bone: " + socket.bone); }

        names.add(socket.name);

        return {
            name: socket.name,
            bone: socket.bone,
            at: (socket.at ?? [0, 0, 0]).map((value) => compile(value, boxes, label, problems)),
            rotation: socket.rotation ?? null,
        };
    });
}

function checkRegions(regions, bones, where, problems)
{
    for(const [name, entries] of Object.entries(regions))
    {
        for(const entry of entries)
        {
            const bone = bones.find((candidate) => candidate.name === entry.bone);

            if(!bone?.box) { problems.push(where + " region " + name + " covers a bone without a box: " + entry.bone); }
            if(entry.faces && !entry.faces.every((face) => FACES.includes(face))) { problems.push(where + " region " + name + " names an unknown face"); }
            if(entry.rows && !entry.rows.every(Number.isInteger)) { problems.push(where + " region " + name + " needs whole-number rows"); }
        }
    }

    return regions;
}

function checkHierarchy(bones, where, problems)
{
    const names = new Set();

    for(const bone of bones)
    {
        if(names.has(bone.name)) { problems.push(where + " lists the bone " + bone.name + " twice"); }

        names.add(bone.name);
    }

    for(const bone of bones)
    {
        const seen = new Set([bone.name]);
        let parent = bone.parent;

        while(parent !== "root")
        {
            const next = bones.find((entry) => entry.name === parent);

            if(!next) { problems.push(where + " bone " + bone.name + " hangs from an unknown bone: " + parent); break; }
            if(seen.has(parent)) { problems.push(where + " bone " + bone.name + " is its own ancestor"); break; }

            seen.add(parent);
            parent = next.parent;
        }
    }
}

/* EXPRESSIONS ****************************************************************/

function linear(constant)
{
    return { c: constant, t: [] };
}

// Accepts sums such as "torso.w/2 + arm.w/2 - 1" and "2*leg.h".
export function compile(expression, boxes, label, problems)
{
    if(typeof expression === "number") { return linear(expression); }
    if(expression?.negate !== undefined) { return scaled(compile(expression.negate, boxes, label, problems), -1); }

    const text = String(expression).replace(/\s+/g, "");
    const signed = /^[+-]/.test(text) ? text : "+" + text;
    const terms = [...signed.matchAll(/([+-])([^+-]+)/g)];
    const form = linear(0);

    if(terms.map((match) => match[0]).join("") !== signed)
    {
        problems.push(label + " has an expression it cannot read: " + expression);
        return form;
    }

    for(const [, sign, term] of terms)
    {
        const parsed = TERM.exec(term);
        const direction = sign === "-" ? -1 : 1;

        if(!parsed) { problems.push(label + " has a term it cannot read: " + term); continue; }
        if(parsed[5] !== undefined) { form.c += direction * Number(parsed[5]); continue; }
        if(!boxes.includes(parsed[2])) { problems.push(label + " refers to an unknown box: " + parsed[2]); continue; }

        const coefficient = direction * Number(parsed[1] ?? 1) / Number(parsed[4] ?? 1);

        form.t.push([coefficient, parsed[2], AXES[parsed[3]]]);
    }

    return form;
}

function scaled(form, factor)
{
    return { c: form.c * factor, t: form.t.map(([coefficient, box, axis]) => [coefficient * factor, box, axis]) };
}


/******************************************************************************/
/* BODIES                                                                     */
/******************************************************************************/

export function checkBody(source, rigs, problems)
{
    const where = "Body " + source.file;
    const before = problems.length;
    const rig = rigs.get(source.rig);

    if(!ID_PATTERN.test(source.id ?? "")) { problems.push(where + " has an invalid id: " + source.id); }
    if(typeof source.name !== "string" || source.name === "") { problems.push(where + " has no name"); }
    if(!rig) { problems.push(where + " uses an unknown rig: " + source.rig); return null; }
    if(!Number.isFinite(source.order)) { problems.push(where + " has no order"); }
    if(!SURFACES.includes(source.surface)) { problems.push(where + " has an unknown surface: " + source.surface); }

    checkBoxes(source.boxes, rig, where, problems);
    checkVariants(source.variants, rig, where, problems);
    checkSliders(source.sliders ?? {}, rig, where, problems);
    checkColours(source, where, problems);

    for(const measure of MEASURES)
    {
        if(!(source.measures?.[measure] > 0)) { problems.push(where + " needs a positive " + measure + " measure"); }
    }

    if(!(source.measures?.run > source.measures?.walk)) { problems.push(where + " must run faster than it walks"); }

    for(const bone of Object.keys(source.shades ?? {}))
    {
        if(!rig.bones.some((entry) => entry.name === bone && entry.box)) { problems.push(where + " shades a bone the rig does not box: " + bone); }
    }

    if(problems.length > before) { return null; }

    const body =
    {
        id: source.id,
        name: source.name,
        rig: source.rig,
        order: source.order,
        playable: source.playable === true,
        surface: source.surface,
        boxes: source.boxes,
        variants: source.variants.map((variant) => ({ id: variant.id, name: variant.name, boxes: variant.boxes ?? {} })),
        sliders: source.sliders ?? {},
        measures: source.measures,
        skins: source.skins,
        shades: source.shades ?? {},
        features: source.features ?? [],
        random: source.random ?? {},
    };

    checkFits(body, where, problems);

    return problems.length > before ? null : body;
}

function checkBoxes(boxes, rig, where, problems)
{
    for(const name of rig.boxes)
    {
        const size = boxes?.[name];

        if(!Array.isArray(size) || size.length !== 3 || !size.every((value) => value > 0)) { problems.push(where + " needs three positive sizes for the " + name + " box"); }
    }

    for(const name of Object.keys(boxes ?? {}))
    {
        if(!rig.boxes.includes(name)) { problems.push(where + " sizes a box the rig does not have: " + name); }
    }
}

function checkDeltas(deltas, rig, label, problems)
{
    for(const [name, delta] of Object.entries(deltas ?? {}))
    {
        if(!rig.boxes.includes(name)) { problems.push(label + " changes a box the rig does not have: " + name); }
        if(!Array.isArray(delta) || delta.length !== 3 || !delta.every(Number.isFinite)) { problems.push(label + " needs three numbers to change the " + name + " box"); }
    }
}

function checkVariants(variants, rig, where, problems)
{
    if(!Array.isArray(variants) || variants.length === 0) { problems.push(where + " needs at least one variant"); return; }

    const ids = new Set();

    for(const variant of variants)
    {
        if(!ID_PATTERN.test(variant.id ?? "") || ids.has(variant.id)) { problems.push(where + " has a missing or repeated variant id: " + variant.id); }
        if(typeof variant.name !== "string") { problems.push(where + " variant " + variant.id + " has no name"); }

        ids.add(variant.id);
        checkDeltas(variant.boxes, rig, where + " variant " + variant.id, problems);
    }
}

function checkSliders(sliders, rig, where, problems)
{
    for(const [name, slider] of Object.entries(sliders))
    {
        const isBuild = name === "build" && Number.isInteger(slider.steps) && slider.steps > 0;
        const isHeight = name === "height" && Number.isFinite(slider.scale);

        if(!isBuild && !isHeight) { problems.push(where + " has an unknown slider or slider shape: " + name); }
        if(isBuild) { checkDeltas(slider.boxes, rig, where + " build slider", problems); }
    }
}

function checkColours(source, where, problems)
{
    const skins = source.skins;

    if(!Array.isArray(skins) || skins.length === 0 || !skins.every((colour) => COLOUR_PATTERN.test(colour))) { problems.push(where + " needs a list of lower-case #rrggbb skin colours"); }
}

function checkFits(body, where, problems)
{
    for(const variant of body.variants)
    {
        for(const build of SLIDER_VALUES)
        {
            for(const [name, size] of Object.entries(Fitter.boxes(body, variant.id, { build })))
            {
                if(!size.every((value) => value > 0)) { problems.push(where + " variant " + variant.id + " makes the " + name + " box " + size.join(" by ") + " at build " + build); }
            }
        }
    }
}
