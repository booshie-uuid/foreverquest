import * as Shared from "../shared.js";

const CLOTH = { stamp: "cloth", tint: "primary" };

export const PART =
{
    id: "tunic",
    slot: "chest",
    name: "Tunic",
    order: 2,
    tints: { primary: "cloth", trim: "cloth" },
    colour: "#3e4a2a",
    trimColour: "#4a3424",
    paint:
    [
        { region: "torso", ...CLOTH },
        { region: "sleeves", faces: Shared.SIDES, ...CLOTH },
        { region: "arms", faces: ["top"], ...CLOTH },
        { region: "torso", faces: Shared.SIDES, rows: [-6, -4], stamp: "leather", tint: "trim" },
    ],
    blocks:
    [
        { at: "legL", mirror: "legR", size: ["leg.w + 1.6", 12, "leg.d + 1.6"], centre: [0, -5.5, 0], faces: { top: [CLOTH], all: [CLOTH, { stamp: "hem", place: "tile bottom", tint: "primary" }] } },
    ],
};
