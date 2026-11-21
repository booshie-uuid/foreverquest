import * as Shared from "../shared.js";

export const PART =
{
    id: "shoes",
    slot: "feet",
    paint:
    [
        { region: "legs", faces: Shared.SIDES, rows: [-5], stamp: "leather", tint: "primary" },
        { region: "legs", faces: ["bottom"], stamp: "leather", tint: Shared.SOLE },
    ],
};
