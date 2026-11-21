import * as Compositor from "../kit/compositor.js";

const FACES = ["front", "back", "left", "right", "top", "bottom"];

export function layers(look, fitted)
{
    const result = {};
    const colours = { skin: look.get("skin") };

    for(const bone of fitted.bones)
    {
        if(!bone.size) { continue; }

        const layer = { stamp: "grit", place: ["tile", "tile"], rows: null, tint: { of: "skin", shade: fitted.body.shades[bone.name] ?? 1 } };
        const painter = Compositor.painter(look.library.stamps, [layer], colours);

        result[bone.name] = Object.fromEntries(FACES.map((face) => [face, [painter]]));
    }

    return result;
}
