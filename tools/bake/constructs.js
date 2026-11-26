import * as FineMesher from "../../js/render/fine-mesher.js";
import * as Fitter from "../../js/kit/fitter.js";
import * as WorldTextures from "../../content/world-textures.js";
import * as fs from "node:fs";
import * as path from "node:path";

const CONTENT = path.resolve(import.meta.dirname, "..", "..", "content", "constructs");
const ID_PATTERN = /^[a-z][A-Za-z0-9]*$/;
const MEASURES = ["radius", "walk", "run", "nameplate", "focus"];
const MAX_FINE = 96;
const MAX_TRIANGLES = 12000;
const TEXELS_PER_FINE = 2;
const TEXELS_PER_CUBE = 16;


/******************************************************************************/
/* BAKE                                                                       */
/******************************************************************************/

export function bake(problems, context)
{
    const constructs = {};
    const blocks = new Map(context.blocks.map((block) => [block.id, block]));
    const files = fs.existsSync(CONTENT) ? fs.readdirSync(CONTENT).filter((name) => name.endsWith(".json")).sort() : [];

    for(const file of files)
    {
        const id = path.basename(file, ".json");
        const where = "Construct " + id + " in constructs/" + file;
        const baked = bakeConstruct(id, JSON.parse(fs.readFileSync(path.join(CONTENT, file), "utf8")), { blocks, rigs: context.rigs, objects: context.objects ?? {} }, where, problems);

        if(baked) { constructs[id] = baked; }
    }

    context.constructs = constructs;

    return {
        files: [{ path: "models/constructs.json", bytes: Buffer.from(JSON.stringify(constructs) + "\n") }],
        ids: { construct: Object.keys(constructs) },
    };
}

// `known` holds the block types by id, the compiled rigs and the baked
// objects, whose ids a construct may not take.
export function bakeConstruct(id, data, known, where, problems)
{
    const before = problems.length;
    const rig = known.rigs.get(data.rig);
    const scale = data.scale ?? 1;

    if(!ID_PATTERN.test(id)) { problems.push(where + " has an invalid id"); }
    if(known.objects[id]) { problems.push(where + " takes the id of an object"); }
    if(typeof data.name !== "string" || data.name === "") { problems.push(where + " has no name"); }
    if(!rig) { problems.push(where + " uses an unknown rig: " + data.rig); }
    if(!(Number.isFinite(scale) && scale > 0)) { problems.push(where + " needs a scale above 0"); }

    for(const measure of MEASURES)
    {
        if(!(data.measures?.[measure] > 0)) { problems.push(where + " needs a positive " + measure + " measure"); }
    }

    if(!(data.measures?.run > data.measures?.walk)) { problems.push(where + " must run faster than it walks"); }
    if(!rig) { return null; }

    const pieces = piecesOf(data, rig, known.blocks, where, problems);
    const extras = (data.extras ?? []).map((extra, i) => extraOf(extra, i, rig, known.blocks, where, problems));
    const dormant = data.dormant ?? {};

    for(const [bone, angles] of Object.entries(dormant))
    {
        if(!rig.bones.some((entry) => entry.name === bone) || !(Array.isArray(angles) && angles.length === 3 && angles.every(Number.isFinite))) { problems.push(where + " needs a dormant pose of [x, y, z] angles for each of its rig's bones it turns, not " + bone); }
    }

    if(problems.length > before) { return null; }

    const boxes = boxesOf(rig, pieces, where, problems);
    const triangles = [...Object.values(pieces), ...extras.map((extra) => extra.piece)].reduce((sum, piece) => sum + trianglesOf(piece, known.blocks), 0);

    if(triangles > MAX_TRIANGLES) { problems.push(where + " has " + triangles + " triangles, more than " + MAX_TRIANGLES); }
    if(problems.length > before) { return null; }

    const body = { ...bodyOf(boxes), measures: data.measures };

    return { name: data.name, rig: data.rig, scale, body, pieces, extras, dormant, footprint: footprintOf(rig, body, scale) };
}

/* PIECES *********************************************************************/

// A boxed bone without a piece of its own takes the piece of another bone of
// the same box, mirrored across x, as armR takes armL's.
function piecesOf(data, rig, blocks, where, problems)
{
    const pieces = {};
    const given = data.pieces ?? {};

    for(const [bone, piece] of Object.entries(given))
    {
        if(!rig.bones.some((entry) => entry.name === bone && entry.box)) { problems.push(where + " has a piece for a bone its rig does not box: " + bone); continue; }

        const checked = checkPiece(piece, blocks, where + " piece " + bone, problems);

        if(checked) { pieces[bone] = checked; }
    }

    for(const bone of rig.bones.filter((entry) => entry.box && !given[entry.name]))
    {
        const twin = rig.bones.find((entry) => entry.box === bone.box && pieces[entry.name]);

        if(twin) { pieces[bone.name] = mirrored(pieces[twin.name]); }
        else { problems.push(where + " has no piece for its bone " + bone.name); }
    }

    return pieces;
}

function extraOf(extra, i, rig, blocks, where, problems)
{
    const at = where + " extra " + i;

    if(!rig.bones.some((entry) => entry.name === extra.bone)) { problems.push(at + " hangs on an unknown bone: " + extra.bone); }
    if(!(Array.isArray(extra.at) && extra.at.length === 3 && extra.at.every(Number.isFinite))) { problems.push(at + " needs its middle as [x, y, z] in texels from its bone"); }

    return { bone: extra.bone, at: extra.at, piece: checkPiece(extra.piece, blocks, at, problems) };
}

// A piece is { size, palette, runs } with its size in fine cubes.
function checkPiece(piece, blocks, where, problems)
{
    const before = problems.length;
    const size = piece?.size;

    if(!(Array.isArray(size) && size.length === 3 && size.every((count) => Number.isInteger(count) && count >= 1 && count <= MAX_FINE)) || !Array.isArray(piece.palette) || !Array.isArray(piece.runs))
    {
        problems.push(where + " needs a size of three whole numbers of fine cubes from 1 to " + MAX_FINE + ", a palette and runs");
        return null;
    }

    const total = piece.runs.reduce((sum, value, i) => sum + (i % 2 === 1 ? value : 0), 0);

    if(piece.palette[0] !== null) { problems.push(where + " needs null as the first entry of its palette"); }

    for(const block of piece.palette.slice(1))
    {
        if(!blocks.has(block) || blocks.get(block).kind === "object") { problems.push(where + " uses an unknown block: " + block); }
    }

    if(total !== size[0] * size[1] * size[2] || piece.runs.some((value, i) => i % 2 === 0 && !(value >= 0 && value < piece.palette.length))) { problems.push(where + " has runs that do not fill its " + size.join(" × ") + " fine cubes from its palette"); }

    return problems.length > before ? null : { size, palette: piece.palette, runs: piece.runs };
}

function mirrored(piece)
{
    const grid = FineMesher.decode(piece);
    const [width, height, depth] = grid.size;
    const data = new Uint8Array(grid.data.length);

    for(let y = 0; y < height; y++)
    {
        for(let z = 0; z < depth; z++)
        {
            for(let x = 0; x < width; x++) { data[(y * depth + z) * width + x] = grid.data[(y * depth + z) * width + width - 1 - x]; }
        }
    }

    return { size: piece.size, palette: piece.palette, runs: FineMesher.encode(data) };
}

function trianglesOf(piece, blocks)
{
    if(!piece) { return 0; }

    return FineMesher.mesh(FineMesher.decode(piece), (block) => blocks.get(block).faces, WorldTextures.TEXELS_PER_METRE / WorldTextures.SIZE).indices.length / 3;
}

/* FIT ************************************************************************/

// Each of the rig's boxes takes the size of its bones' pieces in texels.
function boxesOf(rig, pieces, where, problems)
{
    const boxes = {};

    for(const bone of rig.bones.filter((entry) => entry.box))
    {
        const size = pieces[bone.name].size.map((count) => count * TEXELS_PER_FINE);
        const other = boxes[bone.box];

        if(other && other.some((value, axis) => value !== size[axis])) { problems.push(where + " gives the bones of its " + bone.box + " box pieces of different sizes"); }

        boxes[bone.box] = size;
    }

    return boxes;
}

// The cubes a construct standing at rest takes, across, up and along, from
// the boxes of its bones.
function footprintOf(rig, body, scale)
{
    const fitted = Fitter.fit(rig, body, {});
    const byName = new Map(fitted.bones.map((bone) => [bone.name, bone]));
    const jointAt = (bone) => (bone.parent === "root" ? bone.pivot : jointAt(byName.get(bone.parent)).map((value, axis) => value + bone.pivot[axis]));
    let [across, along] = [0, 0];

    for(const bone of fitted.bones.filter((entry) => entry.size))
    {
        const middle = jointAt(bone).map((value, axis) => value + bone.centre[axis]);

        across = Math.max(across, Math.abs(middle[0]) + bone.size[0] / 2);
        along = Math.max(along, Math.abs(middle[2]) + bone.size[2] / 2);
    }

    return [across * 2, fitted.top, along * 2].map((texels) => Math.max(1, Math.ceil((texels * scale) / TEXELS_PER_CUBE)));
}

// The body the fitter sizes a construct's bones from, with one variant and
// no sliders.
function bodyOf(boxes)
{
    return { boxes, variants: [{ id: "plain", boxes: {} }], sliders: {} };
}
