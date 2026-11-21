const CLOTH = { stamp: "cloth", tint: "primary" };

export const PART =
{
    id: "cloak",
    slot: "back",
    blocks:
    [
        { at: "cape", size: ["torso.w + 4", "torso.h + 0.85*leg.h", 1.2], centre: [0, "-torso.h/2 - 0.425*leg.h", 0], faces: { all: [CLOTH, { stamp: "ragged", place: "tile bottom" }] } },
        { at: "torso", size: ["torso.w + 5", 7, "torso.d + 5"], centre: [0, "torso.h - 3", 0], faces: { all: [CLOTH] } },
    ],
};
