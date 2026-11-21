const CLOTH = [{ stamp: "cloth", tint: "primary" }];

export const PART =
{
    id: "brimmed",
    slot: "head",
    name: "Brimmed Hat",
    order: 6,
    tints: { primary: "cloth", trim: "cloth" },
    colour: "#16161a",
    trimColour: "#4a3424",
    blocks:
    [
        { at: "head", size: [32, 1.2, 32], centre: [0, 16.6, 0], faces: { all: CLOTH } },
        { at: "head", size: [17, 9, 17], centre: [0, 21, 0], faces: { all: CLOTH } },
        { at: "head", size: [17.4, 2, 17.4], centre: [0, 18, 0], faces: { all: [{ stamp: "leather", tint: "trim" }] } },
    ],
};
