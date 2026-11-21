import * as Shared from "../shared.js";

const LEATHER = { stamp: "leather", tint: "primary" };

export const PART =
{
    id: "coat",
    slot: "chest",
    paint:
    [
        { region: "torso", ...LEATHER },
        { region: "sleeves", faces: Shared.SIDES, ...LEATHER },
        { region: "arms", faces: ["top"], ...LEATHER },
        { region: "torso", faces: ["front"], stamp: "buttons.line", place: "centre top", tint: "trim" },
        { region: "torso", faces: ["front"], rows: [0, -3], stamp: "buttons.studs", place: "centre top", tint: "trim" },
        { region: "torso", faces: Shared.SIDES, rows: [0, 3], stamp: "leather", tint: { of: "primary", shade: 1.4 } },
    ],
    blocks: [Shared.tails("leather", 24)],
};
