import * as Catalogue from "../../js/character/catalogue.js";
import * as Kit from "../../js/character/kit.js";
import * as Residents from "../../js/game/residents.js";
import * as WorldTextures from "../../js/world/world-textures.js";
import * as crypto from "node:crypto";
import { Appearance } from "../../js/character/appearance.js";
import { CharacterModel } from "../../js/character/character-model.js";
import { MaterialLibrary } from "../../js/engine/materials.js";
import { Random } from "../../js/util/random.js";
import { World } from "../../js/world/world.js";

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

function blockRecord(block)
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
export function appearanceInputs()
{
    const inputs = [{ label: "default", look: new Appearance().toJSON() }];

    for(const resident of Residents.RESIDENTS) { inputs.push({ label: "resident " + resident.look.name, look: new Appearance(resident.look).toJSON() }); }

    for(const race of Catalogue.RACES)
    {
        for(const body of Catalogue.BODY_TYPES)
        {
            for(const [height, build] of [[0, 0], [1, -1], [-1, 1], [0.37, 0.62]])
            {
                inputs.push({ label: race.id + " " + body.id + " " + height + " " + build, look: new Appearance({ race: race.id, body: body.id, height, build }).toJSON() });
            }
        }
    }

    for(const seed of RANDOM_SEEDS)
    {
        inputs.push({ label: "random " + seed, look: new Appearance(Appearance.randomData(new Random(seed))).toJSON() });
    }

    return inputs;
}

export function characterRecord(look)
{
    const appearance = new Appearance(look);
    const model = new CharacterModel(appearance);
    const dims = Kit.dimensions(appearance);

    model.root.updateMatrixWorld(true);

    const joints = {};

    for(const [name, joint] of Object.entries(Kit.joints(dims)))
    {
        const node = model.joints[name];

        joints[name] = { parent: joint.parent, at: round(node.position.toArray()) };
    }

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
        bodyBlocks: Kit.bodyBlocks(dims).map(blockRecord),
        partBlocks: Kit.partBlocks(appearance, dims).map(blockRecord),
        meshes,
        triangles: model.triangleCount,
        sheet: { width: model.textures.map.image.width, height: model.textures.map.image.height, map: hash(model.textures.map.image.data), glow: hash(model.textures.glow.image.data) },
    };

    model.dispose();

    return record;
}

// The blocks of every option on every race and body, for the part port to
// match. Texels are left out, because the port changes how parts paint.
export function partSweep()
{
    const sweep = {};
    const fields = { nose: Catalogue.NOSES, hair: Catalogue.HAIR_STYLES, beard: Catalogue.BEARD_STYLES };

    for(const race of Catalogue.RACES)
    {
        for(const body of Catalogue.BODY_TYPES)
        {
            const base = { race: race.id, body: body.id, hair: "bald", beard: "none", equipment: {} };

            for(const slot of Catalogue.SLOTS) { base.equipment[slot.id] = { item: "none" }; }

            for(const [field, options] of Object.entries(fields))
            {
                for(const option of options) { sweep[race.id + " " + body.id + " " + field + "=" + option.id] = partBlocks({ ...base, [field]: option.id }); }
            }

            for(const slot of Catalogue.SLOTS)
            {
                for(const item of Catalogue.EQUIPMENT[slot.id])
                {
                    const equipment = { ...base.equipment, [slot.id]: { item: item.id } };

                    sweep[race.id + " " + body.id + " " + slot.id + "=" + item.id] = partBlocks({ ...base, equipment });
                }
            }
        }
    }

    return sweep;
}

function partBlocks(look)
{
    const appearance = new Appearance(look);

    return Kit.partBlocks(appearance, Kit.dimensions(appearance)).map(blockRecord);
}


/******************************************************************************/
/* ZONE                                                                       */
/******************************************************************************/

export function worldTexturesRecord()
{
    return { layers: [...WorldTextures.NAMES], upload: hash(WorldTextures.paintAll()) };
}

export function zoneRecord()
{
    const world = new World(new MaterialLibrary(), 7);
    const terrain = world.terrain;
    const meshes = {};

    world.scene.traverse((node) =>
    {
        if(node.name !== "terrain" && node.name !== "props") { return; }

        const geometry = node.geometry;

        meshes[node.name] = hash(geometry.getAttribute("position").array, geometry.getAttribute("normal").array, geometry.getAttribute("uv").array, geometry.getAttribute("layer").array);
    });

    return {
        size: terrain.size,
        levels: hash(terrain.levels),
        types: hash(new TextEncoder().encode(terrain.types.join(","))),
        colliders: world.colliders.map((collider) => Object.fromEntries(Object.entries(collider).map(([key, value]) => [key, round(value)]))),
        lightSpots: world.lightSpots.map(round),
        meshes,
    };
}
