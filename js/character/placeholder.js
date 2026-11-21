import * as Pixels from "../art/pixels.js";

const FACES = ["front", "back", "left", "right", "top", "bottom"];

export function layers(look, fitted)
{
    const result = {};
    const skin = look.get("skin");

    for(const bone of fitted.bones)
    {
        if(!bone.size) { continue; }

        const colour = Pixels.shade(skin, fitted.body.shades[bone.name] ?? 1);
        const painter = (raster, area, random) => Pixels.grit(raster, area, colour, random, 0.08);

        result[bone.name] = Object.fromEntries(FACES.map((face) => [face, [painter]]));
    }

    return result;
}
