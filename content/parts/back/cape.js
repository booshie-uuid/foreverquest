export const PART =
{
    id: "cape",
    slot: "back",
    name: "Cape",
    order: 1,
    tints: { primary: "cloth" },
    colour: "#4a1a18",
    blocks:
    [
        { at: "cape", size: ["torso.w + 2", "torso.h + 0.75*leg.h", 1.2], centre: [0, "-torso.h/2 - 0.375*leg.h", 0], faces: { all: [{ stamp: "cloth", tint: "primary" }] } },
        { at: "torso", size: ["torso.w + 3", 3, "torso.d + 3"], centre: [0, "torso.h - 1", 0], faces: { all: [{ stamp: "cloth", tint: { of: "primary", shade: 0.8 } }] } },
    ],
};
