import { ZoneData } from "../sim/zone-data.js";

export function addPrefab(builder, atlas, prefab, placement)
{
    for(const block of prefab.blocks)
    {
        const rotation = block.rotation ? [block.rotation[0], block.rotation[1] + placement.angle, block.rotation[2]] : [0, placement.angle, 0];

        addBlock(builder, atlas, block.size.map((value) => value * placement.scale), ZoneData.toWorld(block.at, placement), block.faces, rotation);
    }
}

// The blocks are in zone coordinates.
export function addBlocks(builder, atlas, blocks)
{
    for(const block of blocks) { addBlock(builder, atlas, block.size, block.at, block.faces, block.rotation); }
}

// The texture starts at an offset drawn from the block's position, so blocks
// of one texture side by side do not repeat the same texels.
function addBlock(builder, atlas, size, at, faces, rotation)
{
    const perMetre = atlas.uvPerMetre;
    const offsetU = ((at[0] * 0.37 + at[2] * 0.61) * perMetre) % 1;
    const offsetV = (at[1] * perMetre) % 1;

    builder.add(size, at, rotation, (face, width, height) =>
    {
        const name = faces[face];

        if(!name) { return null; }

        return { uv: [offsetU, offsetV, offsetU + width * perMetre, offsetV + height * perMetre], layer: atlas.layer(name) };
    });
}
