import * as Shared from "../shared.js";

export const PART =
{
    id: "gauntlets",
    slot: "hands",
    name: "Gauntlets",
    order: 2,
    tints: { primary: "metal" },
    colour: "#7a7e85",
    paint:
    [
        { region: "arms", faces: Shared.SIDES, rows: [-10], stamp: "plate", tint: "primary" },
        { region: "arms", faces: ["bottom"], stamp: "plate", tint: "primary" },
    ],
};
