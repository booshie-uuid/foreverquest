// Grip blocks run along +y from the hand towards the tip.
export const PART =
{
    id: "dagger",
    slot: "offHand",
    stance: "dagger",
    blocks:
    [
        { at: "grip.L", size: [2, 5, 2], centre: [0, 0, 0], faces: { all: [{ stamp: "leather", tint: "trim" }] } },
        { at: "grip.L", size: [1, 11, 2.4], centre: [0, 8, 0], faces: { all: [{ stamp: "plate", tint: "primary" }] } },
    ],
};
