import * as fs from "node:fs";
import * as path from "node:path";
import { AssetSource } from "../../js/engine/asset-source.js";
import { BlockSet } from "../../js/sim/block-set.js";
import { Library } from "../../js/kit/library.js";
import { MaterialLibrary } from "../../js/engine/materials.js";
import { WorldAtlas } from "../../js/engine/world-atlas.js";
import { ZoneData } from "../../js/sim/zone-data.js";

export const ASSETS = path.resolve(import.meta.dirname, "..", "..", "assets");

export function open()
{
    return AssetSource.open((file) => fs.promises.readFile(path.join(ASSETS, file)));
}

export async function atlas()
{
    return WorldAtlas.load(await open());
}

export async function blocks()
{
    return BlockSet.load(await open());
}

export async function library()
{
    return Library.load(await open());
}

export async function objects()
{
    return (await open()).json("objects.json");
}

export async function people()
{
    return (await open()).json("npcs.json");
}

export async function prefabs()
{
    return (await open()).json("props/prefabs.json");
}

export async function zone(id)
{
    const source = await open();

    return ZoneData.load(source, id, await BlockSet.load(source));
}

export async function materials()
{
    return new MaterialLibrary(await atlas());
}
