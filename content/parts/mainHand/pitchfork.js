const IRON = [{ stamp: "iron", tint: "trim" }];

export const PART =
{
    id: "pitchfork",
    slot: "mainHand",
    name: "Pitchfork",
    order: 6,
    tints: { primary: "cloth", trim: "metal" },
    colour: "#4a3424",
    trimColour: "#4a4e56",
    stance: "pole",
    blocks:
    [
        { at: "hand.R", size: [2, 70, 2], centre: [0, 14, 0], faces: { all: [{ stamp: "planks", tint: "primary" }] } },
        { at: "hand.R", size: [8, 1.4, 1.4], centre: [0, 49, 0], faces: { all: IRON } },
        { at: "hand.R", size: [1, 8, 1], centre: [-3.4, 54, 0], faces: { all: IRON } },
        { at: "hand.R", size: [1, 8, 1], centre: [0, 54, 0], faces: { all: IRON } },
        { at: "hand.R", size: [1, 8, 1], centre: [3.4, 54, 0], faces: { all: IRON } },
    ],
};
