import * as Shared from "../shared.js";

export const PART =
{
    id: "gauntlets",
    slot: "hands",
    paint:
    [
        { region: "arms", faces: Shared.SIDES, rows: [-10], stamp: "plate", tint: "primary" },
        { region: "arms", faces: ["bottom"], stamp: "plate", tint: "primary" },
    ],
};
