import * as Catalogue from "../../content/catalogue.js";

const CORE = "core";


/******************************************************************************/
/* BAKE                                                                       */
/******************************************************************************/

// Runs after the blocks, prefabs and objects have baked into `context`, and
// before the zones, whose showcases read the catalogue.
export function bake(problems, context)
{
    const blockIds = context.blocks.filter((block) => block.kind !== "object").map((block) => block.id);
    const pieceIds = [...new Set([...Object.keys(context.prefabs), ...Object.keys(context.objects)])];
    const catalogue = bakeCatalogue(Catalogue, blockIds, pieceIds, problems);

    context.catalogue = catalogue;

    return {
        files: [{ path: "catalogue.json", bytes: Buffer.from(JSON.stringify(catalogue, null, 4) + "\n") }],
        ids: {},
    };
}

// `source` holds BLOCK_TYPES, PIECE_TYPES and PACKS as content/catalogue.js
// exports them. A piece missing from the catalogue is left out, and the
// editor lists it as Other.
export function bakeCatalogue(source, blockIds, pieceIds, problems)
{
    const blocks = entriesOf(source.BLOCK_TYPES, new Set(blockIds), "block", problems);
    const pieces = entriesOf(source.PIECE_TYPES, new Set(pieceIds.map(baseOf)), "piece", problems);

    for(const id of blockIds.filter((each) => !blocks[each])) { problems.push("Block " + id + " needs a type in catalogue.js"); }

    if(!source.PACKS[CORE]) { problems.push("The catalogue needs a " + CORE + " pack"); }

    for(const [pack, { blocks: packBlocks = [], pieces: packPieces = [] }] of Object.entries(source.PACKS))
    {
        addPack(blocks, packBlocks, pack, "block", problems);
        addPack(pieces, packPieces, pack, "piece", problems);
    }

    const listed = pieceIds.filter((id) => pieces[baseOf(id)]).sort();

    return {
        blockTypes: labelsOf(source.BLOCK_TYPES),
        pieceTypes: labelsOf(source.PIECE_TYPES),
        packs: labelsOf(source.PACKS),
        blocks,
        pieces: Object.fromEntries(listed.map((id) => [id, pieces[baseOf(id)]])),
    };
}

// A prefab variant, such as `pine.3`, shares the entry of `pine`.
function baseOf(id)
{
    return id.split(".")[0];
}

function entriesOf(types, known, noun, problems)
{
    const entries = {};

    for(const [type, { ids }] of Object.entries(types))
    {
        for(const id of ids)
        {
            if(!known.has(id)) { problems.push("The catalogue's " + type + " type names an unknown " + noun + ": " + id); }
            else if(entries[id]) { problems.push("The catalogue lists the " + noun + " " + id + " under both " + entries[id].type + " and " + type); }
            else { entries[id] = { type, pack: CORE }; }
        }
    }

    return entries;
}

function addPack(entries, ids, pack, noun, problems)
{
    for(const id of ids)
    {
        if(!entries[id]) { problems.push("The catalogue's " + pack + " pack names a " + noun + " with no type: " + id); }
        else if(entries[id].pack !== CORE) { problems.push("The catalogue lists the " + noun + " " + id + " in both the " + entries[id].pack + " and " + pack + " packs"); }
        else { entries[id].pack = pack; }
    }
}

function labelsOf(groups)
{
    return Object.entries(groups).map(([id, { label }]) => [id, label]);
}
