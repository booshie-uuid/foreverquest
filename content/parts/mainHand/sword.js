// Grip blocks run along +y from the hand towards the tip.
export const PART =
{
    id: "sword",
    slot: "mainHand",
    stance: "blade",
    blocks:
    [
        { at: "grip.R", size: [2, 7, 2], centre: [0, 0, 0], faces: { all: [{ stamp: "leather", tint: "trim" }] } },
        { at: "grip.R", size: [10, 1.6, 2.4], centre: [0, 4, 0], faces: { all: [{ stamp: "iron", tint: "#2a2a2c" }] } },
        { at: "grip.R", size: [1.4, 28, 4], centre: [0, 19, 0], faces: { all: [{ stamp: "plate", tint: "primary" }] } },
    ],
};
