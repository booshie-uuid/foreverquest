import * as Shared from "../shared.js";

export const PART =
{
    id: "breeches",
    slot: "legs",
    name: "Breeches",
    order: 2,
    tints: { primary: "cloth" },
    colour: "#5a5246",
    paint:
    [
        { region: "legs", faces: Shared.SIDES, rows: [0, 0.55], stamp: "cloth", tint: "primary" },
        { region: "legs", faces: Shared.SIDES, rows: [0.55], stamp: "cloth", tint: "#4a443a" },
        { region: "legs", faces: ["top"], stamp: "cloth", tint: "primary" },
    ],
};
