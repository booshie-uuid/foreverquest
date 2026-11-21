export const PART =
{
    id: "pack",
    slot: "back",
    name: "Pack",
    order: 3,
    tints: { primary: "cloth", trim: "cloth" },
    colour: "#4a3424",
    trimColour: "#6a5a3a",
    blocks:
    [
        { at: "torso", size: ["torso.w - 6", 16, 7], centre: [0, "0.55*torso.h", "-torso.d/2 - 3.5"], faces: { all: [{ stamp: "leather", tint: "primary" }] } },
        { at: "torso", size: ["torso.w - 2", 4, 4], centre: [0, "0.55*torso.h + 10", "-torso.d/2 - 3.5"], faces: { all: [{ stamp: "cloth", tint: "trim" }] } },
    ],
};
