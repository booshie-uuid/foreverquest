import * as Shared from "../shared.js";

const LEATHER = { stamp: "leather", tint: "primary" };
const LINEN = { stamp: "cloth", tint: Shared.LINEN };

export const PART =
{
    id: "jerkin",
    slot: "chest",
    name: "Leather Jerkin",
    order: 4,
    tints: { primary: "cloth", trim: "cloth" },
    colour: "#4a3424",
    trimColour: "#2e241c",
    paint:
    [
        { region: "torso", ...LINEN },
        { region: "torso", ...LEATHER },
        { region: "sleeves", faces: Shared.SIDES, ...LINEN },
        { region: "arms", faces: Shared.SIDES, rows: [0, 10], ...LEATHER },
        { region: "arms", faces: ["top"], ...LEATHER },
        { region: "torso", faces: ["front"], rows: [0, -6], stamp: "straps.left", place: "left top", tint: "trim" },
        { region: "torso", faces: ["front"], rows: [0, -6], stamp: "straps.right", place: "right top", tint: "trim" },
        { region: "torso", faces: Shared.SIDES, rows: [-6, -4], stamp: "leather", tint: "trim" },
    ],
    blocks: [{ at: "armL", mirror: "armR", size: ["arm.w + 3", 5, "arm.d + 4"], centre: [0.6, 2, 0], faces: { all: [{ stamp: "leather", tint: "trim" }] } }],
};
