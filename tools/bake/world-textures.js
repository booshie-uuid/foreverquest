import * as PngWriter from "./png-writer.js";
import * as WorldTextures from "../../content/world-textures.js";
import { Random } from "../../js/util/random.js";
import { Raster } from "../../js/engine/raster.js";

const NAME_PATTERN = /^[a-z][A-Za-z0-9]*$/;

export function bake(problems)
{
    const { SIZE, TEXELS_PER_METRE, TEXTURES } = WorldTextures;
    const strip = new Raster(SIZE, SIZE * TEXTURES.length);
    const names = new Set();

    TEXTURES.forEach((texture, i) =>
    {
        if(!NAME_PATTERN.test(texture.name)) { problems.push("World texture " + i + " has an invalid name: " + texture.name); }
        if(names.has(texture.name)) { problems.push("World texture " + texture.name + " is listed twice"); }
        if(!Number.isInteger(texture.seed)) { problems.push("World texture " + texture.name + " has no whole-number seed"); }

        names.add(texture.name);
        texture.paint(strip, { x: 0, y: i * SIZE, w: SIZE, h: SIZE }, new Random(texture.seed));
    });

    for(let i = 3; i < strip.data.length; i += 4)
    {
        if(strip.data[i] !== 255)
        {
            problems.push("World texture " + TEXTURES[Math.floor(i / 4 / SIZE / SIZE)].name + " has a texel that is not opaque");
            break;
        }
    }

    const index =
    {
        size: SIZE,
        texelsPerMetre: TEXELS_PER_METRE,
        layers: TEXTURES.map((texture) => ({ name: texture.name, glow: texture.glow === true })),
    };

    return {
        files:
        [
            { path: "textures/world.png", bytes: PngWriter.encode(strip.width, strip.height, strip.data) },
            { path: "textures/world.json", bytes: Buffer.from(JSON.stringify(index, null, 4) + "\n") },
        ],
        ids: { "world-texture": [...names] },
    };
}
