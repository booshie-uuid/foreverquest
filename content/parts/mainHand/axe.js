// Grip blocks run along +y from the hand towards the tip, and +z is the edge.
export const PART =
{
    id: "axe",
    slot: "mainHand",
    name: "Axe",
    order: 2,
    tints: { primary: "metal", trim: "cloth" },
    colour: "#7a7e85",
    trimColour: "#4a3424",
    stance: "blade",
    blocks:
    [
        { at: "grip.R", size: [2, 32, 2], centre: [0, 10, 0], faces: { all: [{ stamp: "planks", tint: "trim" }] } },
        { at: "grip.R", size: [1.4, 9, 7], centre: [0, 19, 3.5], faces: { all: [{ stamp: "plate", tint: "primary" }] } },
    ],
};
