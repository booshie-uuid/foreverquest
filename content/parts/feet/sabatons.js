import * as Shared from "../shared.js";

export const PART =
{
    id: "sabatons",
    slot: "feet",
    paint:
    [
        { region: "legs", faces: Shared.SIDES, rows: [-9], stamp: "plate", tint: "primary" },
        { region: "legs", faces: ["bottom"], stamp: "plate", tint: { of: "primary", shade: 0.6 } },
    ],
};
