import * as Pixels from "../art/pixels.js";
import * as THREE from "three";
import { Random } from "../util/random.js";
import { Raster } from "../engine/raster.js";

export const SIZE = 32;
export const TEXELS_PER_METRE = 16;

const LAYERS =
[
    ["grass", (r, a, random) => Pixels.grass(r, a, random)],
    ["moss", (r, a, random) => Pixels.grass(r, a, random, "#33381f")],
    ["mud", (r, a, random) => Pixels.mud(r, a, random)],
    ["cobble", (r, a, random) => Pixels.cobble(r, a, random)],
    ["earth", (r, a, random) => Pixels.earth(r, a, random)],
    ["sand", (r, a, random) => Pixels.grit(r, a, "#5e5644", random, 0.2)],
    ["stone", (r, a, random) => Pixels.stone(r, a, random, "#6a655c")],
    ["darkStone", (r, a, random) => Pixels.stone(r, a, random, "#4e4a44")],
    ["grave", (r, a, random) => Pixels.stone(r, a, random, "#7a776e")],
    ["plaster", (r, a, random) => Pixels.plaster(r, a, random)],
    ["timber", (r, a, random) => Pixels.timber(r, a, random)],
    ["planks", (r, a, random) => Pixels.planks(r, a, random, "#4a3826")],
    ["oldPlanks", (r, a, random) => Pixels.planks(r, a, random, "#4a4640")],
    ["slate", (r, a, random) => Pixels.slate(r, a, random)],
    ["thatch", (r, a, random) => Pixels.thatch(r, a, random)],
    ["bark", (r, a, random) => Pixels.bark(r, a, random)],
    ["needles", (r, a, random) => Pixels.needles(r, a, random)],
    ["leaves", (r, a, random) => Pixels.needles(r, a, random, "#3a3f24")],
    ["iron", (r, a, random) => Pixels.iron(r, a, random)],
    ["sacking", (r, a, random) => Pixels.cloth(r, a, random, "#5e5446")],
    ["banner", (r, a, random) => Pixels.cloth(r, a, random, "#4a1a18")],
    ["glow", (r, a, random) => Pixels.glow(r, a, random)],
];

export const NAMES = LAYERS.map(([name]) => name);

export function index(name)
{
    const found = NAMES.indexOf(name);

    if(found < 0) { throw new Error("Unknown world texture: " + name); }

    return found;
}

// Rows are painted top-down and uploaded bottom-up, so each layer flips.
export function paintAll()
{
    const layerBytes = SIZE * SIZE * 4;
    const data = new Uint8Array(layerBytes * LAYERS.length);

    LAYERS.forEach(([, painter], i) =>
    {
        const raster = new Raster(SIZE, SIZE);

        painter(raster, Pixels.area(0, 0, SIZE, SIZE), new Random(400 + i * 13));

        for(let y = 0; y < SIZE; y++)
        {
            const row = raster.data.subarray(y * SIZE * 4, (y + 1) * SIZE * 4);

            data.set(row, i * layerBytes + (SIZE - 1 - y) * SIZE * 4);
        }
    });

    return data;
}

export function createAtlas()
{
    const texture = new THREE.DataArrayTexture(paintAll(), SIZE, SIZE, LAYERS.length);

    texture.format = THREE.RGBAFormat;
    texture.type = THREE.UnsignedByteType;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;

    return texture;
}
