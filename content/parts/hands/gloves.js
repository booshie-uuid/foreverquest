import * as Shared from "../shared.js";

export const PART =
{
    id: "gloves",
    slot: "hands",
    name: "Gloves",
    order: 1,
    tints: { primary: "cloth" },
    colour: "#4a3424",
    paint:
    [
        { region: "arms", faces: Shared.SIDES, rows: [-7], stamp: "leather", tint: "primary" },
        { region: "arms", faces: ["bottom"], stamp: "leather", tint: "primary" },
    ],
};
