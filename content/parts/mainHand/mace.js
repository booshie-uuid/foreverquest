const HEAD = [{ stamp: "plate", tint: "primary" }];

// Grip blocks run along +y from the hand towards the tip.
export const PART =
{
    id: "mace",
    slot: "mainHand",
    name: "Mace",
    order: 3,
    tints: { primary: "metal", trim: "cloth" },
    colour: "#4a4e56",
    trimColour: "#2e241c",
    stance: "blade",
    blocks:
    [
        { at: "grip.R", size: [2, 22, 2], centre: [0, 8, 0], faces: { all: [{ stamp: "planks", tint: "trim" }] } },
        { at: "grip.R", size: [5, 6, 5], centre: [0, 20, 0], faces: { all: HEAD } },
        { at: "grip.R", size: [7, 2, 2], centre: [0, 20, 0], faces: { all: HEAD } },
        { at: "grip.R", size: [2, 2, 7], centre: [0, 20, 0], faces: { all: HEAD } },
    ],
};
