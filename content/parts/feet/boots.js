import * as Shared from "../shared.js";

export const PART =
{
    id: "boots",
    slot: "feet",
    paint:
    [
        { region: "legs", faces: Shared.SIDES, rows: [-16], stamp: "leather", tint: "primary" },
        { region: "legs", faces: Shared.SIDES, rows: [-16, -14], stamp: "leather", tint: { of: "primary", shade: 1.3 } },
        { region: "legs", faces: ["bottom"], stamp: "leather", tint: Shared.SOLE },
    ],
};
