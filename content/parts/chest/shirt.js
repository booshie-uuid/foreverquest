import * as Shared from "../shared.js";

const CLOTH = { stamp: "cloth", tint: "primary" };

export const PART =
{
    id: "shirt",
    slot: "chest",
    name: "Shirt",
    order: 1,
    tints: { primary: "cloth" },
    colour: "#7a705c",
    paint:
    [
        { region: "torso", ...CLOTH },
        { region: "arms", faces: Shared.SIDES, rows: [0, 12], ...CLOTH },
        { region: "arms", faces: ["top"], ...CLOTH },
        { region: "torso", faces: ["front"], stamp: "neckline", place: "centre top", tint: { of: "skin", shade: 0.95 } },
    ],
};
