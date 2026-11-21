const CLOTH = [{ stamp: "cloth", tint: "primary" }];

export const PART =
{
    id: "brimmed",
    slot: "head",
    blocks:
    [
        { at: "head", size: [32, 1.2, 32], centre: [0, 16.6, 0], faces: { all: CLOTH } },
        { at: "head", size: [17, 9, 17], centre: [0, 21, 0], faces: { all: CLOTH } },
        { at: "head", size: [17.4, 2, 17.4], centre: [0, 18, 0], faces: { all: [{ stamp: "leather", tint: "trim" }] } },
    ],
};
