const CLOTH = { stamp: "cloth", tint: "primary" };

export const PART =
{
    id: "hood",
    slot: "head",
    name: "Hood",
    order: 1,
    tints: { primary: "cloth" },
    colour: "#24301f",
    hidesHair: true,
    blocks:
    [
        { at: "head", size: [20, 20, 20], centre: [0, 9, -0.5], faces: { front: [CLOTH, { stamp: "cut.hood", place: "centre centre" }], all: [CLOTH] } },
        { at: "head", size: [8, 6, 8], centre: [0, 16, -12], rotation: [-0.5, 0, 0], faces: { all: [CLOTH] } },
        { at: "torso", size: ["torso.w + 4", 6, "torso.d + 4"], centre: [0, "torso.h - 2", 0], faces: { all: [CLOTH] } },
    ],
};
