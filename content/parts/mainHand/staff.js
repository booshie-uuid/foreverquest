export const PART =
{
    id: "staff",
    slot: "mainHand",
    name: "Staff",
    order: 5,
    tints: { primary: "cloth", trim: "metal" },
    colour: "#2e241c",
    trimColour: "#8a7240",
    stance: "pole",
    blocks:
    [
        { at: "hand.R", size: [2.4, 74, 2.4], centre: [0, 6, 0], faces: { all: [{ stamp: "planks", tint: "primary" }] } },
        { at: "hand.R", size: [4, 4, 4], centre: [0, 44, 0], faces: { all: [{ stamp: "plate", tint: "trim" }] } },
    ],
};
