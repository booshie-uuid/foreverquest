import * as Compositor from "./compositor.js";
import * as Fitter from "./fitter.js";
import * as THREE from "three";

const FACES = ["front", "back", "left", "right", "top", "bottom"];
const LOOK_SLOTS = ["nose", "hair", "face", "beard", "markings"];


/******************************************************************************/
/* DRESS                                                                      */
/******************************************************************************/

// A slot whose part is not in the library adds nothing.
export function dress(fitted, look, library)
{
    const rig = fitted.rig;
    const variant = look.get("variant");
    const base = { skin: look.get("skin"), hair: look.get("hairColour"), eyes: look.get("eyes") };
    const worn = rig.slots.flatMap((slot) => wornParts(look, library, slot, base)).filter((entry) => entry.part);
    const hidesHair = worn.some((entry) => entry.part.hidesHair);
    const layers = {};
    const blocks = [];

    for(const bone of fitted.bones)
    {
        if(bone.size) { layers[bone.name] = Object.fromEntries(FACES.map((face) => [face, []])); }
    }

    for(const layer of rig.base) { addRegionLayer(layers, rig, layer, Compositor.painter(library.stamps, [layer], base)); }

    for(const { part, colours } of worn)
    {
        for(const layer of part.paint)
        {
            if(isWorn(layer, variant)) { addRegionLayer(layers, rig, layer, Compositor.painter(library.stamps, [layer], colours)); }
        }

        if(part.slot === "hair" && hidesHair) { continue; }

        for(const block of part.blocks) { blocks.push(...placeBlock(fitted, block, Compositor.painterFaces(library.stamps, block.faces, colours, variant))); }
    }

    return { blocks, layers };
}

function wornParts(look, library, slot, base)
{
    if(slot === "feature") { return look.body.features.map((id) => ({ part: library.part(slot, id), colours: base })); }
    if(LOOK_SLOTS.includes(slot)) { return [{ part: library.part(slot, look.get(slot)), colours: base }]; }

    const gear = look.equipped(slot);

    return [{ part: library.part(slot, gear.item), colours: { ...base, primary: gear.colour, trim: gear.trim } }];
}

function isWorn(layer, variant)
{
    return !layer.variants || layer.variants.includes(variant);
}

function addRegionLayer(layers, rig, layer, painter)
{
    for(const entry of rig.regions[layer.region])
    {
        const cropped = (raster, area, random, glow) => painter(raster, Compositor.rows(area, entry.rows), random, glow);

        for(const face of entry.faces ?? FACES)
        {
            if(!layer.faces || layer.faces.includes(face)) { layers[entry.bone][face].push(cropped); }
        }
    }
}


/******************************************************************************/
/* BLOCKS                                                                     */
/******************************************************************************/

function placeBlock(fitted, block, faces)
{
    const size = block.size.map((form) => Fitter.evaluate(form, fitted.boxes));
    const centre = block.centre.map((form) => Fitter.evaluate(form, fitted.boxes));
    const placed = [place(fitted, block.at, size, centre, block.rotation, faces)];

    if(block.mirror)
    {
        const rotation = block.rotation ? [block.rotation[0], -block.rotation[1], -block.rotation[2]] : null;

        placed.push(place(fitted, block.mirror, size, [-centre[0], centre[1], centre[2]], rotation, faces));
    }

    return placed;
}

function place(fitted, target, size, centre, rotation, faces)
{
    const socket = socketOf(fitted, target);

    if(!socket.rotation) { return { joint: socket.bone, size, at: add(socket.at, centre), rotation, faces }; }

    const turn = new THREE.Quaternion().setFromEuler(new THREE.Euler(...socket.rotation, "YXZ"));
    const offset = new THREE.Vector3(...centre).applyQuaternion(turn);
    const combined = rotation ? turn.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation, "YXZ"))) : null;

    return {
        joint: socket.bone,
        size,
        at: add(socket.at, offset.toArray()),
        rotation: combined ? new THREE.Euler().setFromQuaternion(combined, "YXZ").toArray().slice(0, 3) : socket.rotation,
        faces,
    };
}

function socketOf(fitted, name)
{
    const socket = fitted.rig.sockets.find((entry) => entry.name === name);

    if(!socket) { return { bone: name, at: [0, 0, 0], rotation: null }; }

    return { bone: socket.bone, at: socket.at.map((form) => Fitter.evaluate(form, fitted.boxes)), rotation: socket.rotation };
}

function add(a, b)
{
    return a.map((value, i) => value + b[i]);
}
