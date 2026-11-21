const PLATE = { stamp: "plate", tint: "primary" };
const HORN = [{ stamp: "leather", tint: "trim" }];

export const PART =
{
    id: "horned",
    slot: "head",
    name: "Horned Helm",
    order: 5,
    tints: { primary: "metal", trim: "cloth" },
    colour: "#4a4e56",
    trimColour: "#9a917c",
    hidesHair: true,
    blocks:
    [
        { at: "head", size: [18, 12, 18], centre: [0, 12, 0], faces: { front: [PLATE, { stamp: "solid", rows: [-2], tint: { of: "primary", shade: 1.4 } }], all: [PLATE] } },
        { at: "head", size: [2, 7, 1.5], centre: [0, 7, 9.5], faces: { all: [PLATE] } },
        { at: "head", mirror: "head", size: [6, 3, 3], centre: [11, 15, 0], rotation: [0, 0, 0.3], faces: { all: HORN } },
        { at: "head", mirror: "head", size: [3, 6, 3], centre: [14, 18.5, 0], rotation: [0, 0, -0.2], faces: { all: HORN } },
        { at: "head", mirror: "head", size: [2, 4, 2], centre: [14.5, 23, 0], faces: { all: HORN } },
    ],
};
