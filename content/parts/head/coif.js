const CHAIN = { stamp: "chain", tint: "primary" };

export const PART =
{
    id: "coif",
    slot: "head",
    hidesHair: true,
    blocks:
    [
        { at: "head", size: [18, 18, 18], centre: [0, 8.5, 0], faces: { front: [CHAIN, { stamp: "cut.coif", place: "centre centre" }], all: [CHAIN] } },
        { at: "torso", size: ["torso.w + 2", 4, "torso.d + 2"], centre: [0, "torso.h - 1", 0], faces: { all: [CHAIN] } },
    ],
};
