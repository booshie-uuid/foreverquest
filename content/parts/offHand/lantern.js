const IRON = { stamp: "iron", tint: "primary" };

export const PART =
{
    id: "lantern",
    slot: "offHand",
    name: "Lantern",
    order: 3,
    tints: { primary: "metal" },
    colour: "#2e3034",
    stance: "lantern",
    blocks:
    [
        { at: "hand.L", size: [5, 7, 5], centre: [0, -7, 0], faces: { top: [IRON], bottom: [IRON], all: [{ stamp: "lamplight" }] } },
        { at: "hand.L", size: [6, 1.2, 6], centre: [0, -3, 0], faces: { all: [IRON] } },
        { at: "hand.L", size: [1, 3, 1], centre: [0, -1.5, 0], faces: { all: [IRON] } },
    ],
};
