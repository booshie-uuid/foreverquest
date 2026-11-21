import * as Shared from "../shared.js";

const PLATE = { stamp: "plate", tint: "primary" };
const CHAIN = { stamp: "chain", tint: "primary" };

export const PART =
{
    id: "plate",
    slot: "chest",
    paint:
    [
        { region: "torso", ...CHAIN },
        { region: "torso", rows: [0, -6], ...PLATE },
        { region: "sleeves", faces: Shared.SIDES, ...CHAIN },
        { region: "arms", faces: Shared.SIDES, rows: [0, 9], ...PLATE },
        { region: "arms", faces: ["top"], ...PLATE },
        { region: "torso", faces: ["front", "back"], stamp: "tabard", place: "centre top", tint: "trim" },
        { region: "torso", faces: Shared.SIDES, rows: [-6, -4], stamp: "leather", tint: "#2a1e16" },
    ],
    blocks:
    [
        { at: "armL", mirror: "armR", size: ["arm.w + 4", 7, "arm.d + 5"], centre: [0.8, 2.5, 0], rotation: [0, 0, -0.18], faces: { all: [PLATE] } },
        { at: "legL", mirror: "legR", size: ["leg.w + 2", 9, "leg.d + 2"], centre: [0, -3.5, 0], faces: { all: [PLATE] } },
    ],
};
