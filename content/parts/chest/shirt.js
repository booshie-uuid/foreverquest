import * as Shared from "../shared.js";

const CLOTH = { stamp: "cloth", tint: "primary" };

export const PART =
{
    id: "shirt",
    slot: "chest",
    paint:
    [
        { region: "torso", ...CLOTH },
        { region: "arms", faces: Shared.SIDES, rows: [0, 12], ...CLOTH },
        { region: "arms", faces: ["top"], ...CLOTH },
        { region: "torso", faces: ["front"], stamp: "neckline", place: "centre top", tint: { of: "skin", shade: 0.95 } },
    ],
};
