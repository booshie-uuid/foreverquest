import * as Dresser from "../../js/kit/dresser.js";
import * as Fitter from "../../js/kit/fitter.js";
import * as Npcs from "../../content/npcs/hearthmere.js";
import * as crypto from "node:crypto";
import { Appearance } from "../../js/character/appearance.js";
import { CharacterModel } from "../../js/character/character-model.js";
import { Random } from "../../js/util/random.js";

const RANDOM_SEEDS = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233];
const PLACES = 6;


/******************************************************************************/
/* HELPERS                                                                    */
/******************************************************************************/

export function hash(...arrays)
{
    const digest = crypto.createHash("sha256");

    for(const array of arrays) { digest.update(new Uint8Array(array.buffer, array.byteOffset, array.byteLength)); }

    return digest.digest("hex");
}

export function round(value)
{
    if(Array.isArray(value)) { return value.map(round); }
    if(typeof value !== "number") { return value; }

    const rounded = Math.round(value * 10 ** PLACES) / 10 ** PLACES;

    return Object.is(rounded, -0) ? 0 : rounded;
}

export function blockRecord(block)
{
    return {
        joint: block.joint,
        size: round(block.size),
        at: round(block.at),
        rotation: block.rotation ? round(block.rotation) : null,
        faces: block.part ? null : Object.keys(block.faces).sort(),
    };
}


/******************************************************************************/
/* CHARACTERS                                                                 */
/******************************************************************************/

// The appearance records the reference was taken from. Inputs are stored with
// the reference, so a change to the random generator cannot move them.
export function appearanceInputs(library)
{
    const inputs = [{ label: "default", look: new Appearance(library).toJSON() }];

    for(const npc of Object.values(Npcs.NPCS)) { inputs.push({ label: "resident " + npc.name, look: new Appearance(library, npc.look).toJSON() }); }

    for(const body of library.playableBodies)
    {
        for(const variant of body.variants)
        {
            for(const [height, build] of [[0, 0], [1, -1], [-1, 1], [0.37, 0.62]])
            {
                inputs.push({ label: body.id + " " + variant.id + " " + height + " " + build, look: new Appearance(library, { body: body.id, variant: variant.id, height, build }).toJSON() });
            }
        }
    }

    for(const seed of RANDOM_SEEDS)
    {
        inputs.push({ label: "random " + seed, look: new Appearance(library, Appearance.randomData(library, new Random(seed))).toJSON() });
    }

    return inputs;
}

export function characterRecord(library, look)
{
    const appearance = new Appearance(library, look);
    const model = new CharacterModel(appearance);
    const fitted = model.plan.fit;

    model.root.updateMatrixWorld(true);

    const joints = {};

    for(const bone of fitted.bones) { joints[bone.name] = { parent: bone.parent, at: round(model.joints[bone.name].position.toArray()) }; }

    const meshes = {};

    for(const mesh of model.meshes)
    {
        const geometry = mesh.geometry;

        meshes[mesh.parent.name] = hash(geometry.getAttribute("position").array, geometry.getAttribute("normal").array, geometry.getAttribute("uv").array);
    }

    const record =
    {
        scale: round(model.body.scale.x),
        height: round(model.plan.height),
        joints,
        bodyBlocks: Fitter.bodyBlocks(fitted).map(blockRecord),
        partBlocks: sorted(Dresser.dress(fitted, appearance, library).blocks.map(blockRecord)),
        meshes,
        triangles: model.triangleCount,
        sheet: { width: model.textures.map.image.width, height: model.textures.map.image.height, map: hash(model.textures.map.image.data), glow: hash(model.textures.glow.image.data) },
    };

    model.dispose();

    return record;
}

// The blocks of every option on every race and body, for the part port to
// match. Texels are left out, because the port changes how parts paint.
export function partSweep(library)
{
    const sweep = {};
    const fields = ["nose", "hair", "beard"];
    const gear = library.rig("humanoid").gear;

    for(const body of library.playableBodies)
    {
        for(const variant of body.variants)
        {
            const label = body.id + " " + variant.id + " ";
            const base = { body: body.id, variant: variant.id, hair: "bald", beard: "none", equipment: {} };

            for(const slot of gear) { base.equipment[slot.id] = { item: "none" }; }

            for(const field of fields)
            {
                for(const option of library.partsFor(field)) { sweep[label + field + "=" + option.id] = partBlocks(library, { ...base, [field]: option.id }); }
            }

            for(const slot of gear)
            {
                for(const item of library.partsFor(slot.id))
                {
                    const equipment = { ...base.equipment, [slot.id]: { item: item.id } };

                    sweep[label + slot.id + "=" + item.id] = partBlocks(library, { ...base, equipment });
                }
            }
        }
    }

    return sweep;
}

function partBlocks(library, look)
{
    const appearance = new Appearance(library, look);
    const fitted = Fitter.fit(library.rig(appearance.body.rig), appearance.body, { variant: appearance.get("variant"), height: appearance.get("height"), build: appearance.get("build") });

    return sorted(Dresser.dress(fitted, appearance, library).blocks.map(blockRecord));
}

// The dresser lists part blocks in the rig's slot order, unlike the prototype.
export function sorted(records)
{
    return [...records].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}


/******************************************************************************/
/* ZONE                                                                       */
/******************************************************************************/

export function worldTexturesRecord(atlas)
{
    return { layers: [...atlas.names], upload: hash(atlas.upload) };
}

// Meshes are left out: the zone draws in chunks.
export function zoneRecord(zone)
{
    return {
        size: zone.size,
        levels: hash(zone.levels),
        types: hash(new TextEncoder().encode(zone.types.join(","))),
        colliders: zone.colliders.map((collider) => Object.fromEntries(Object.entries(collider).map(([key, value]) => [key, round(value)]))),
        lightSpots: zone.lightSpots.map(round),
    };
}
