import * as Shared from "../shared.js";

export const PART =
{
    id: "boots",
    slot: "feet",
    name: "Tall Boots",
    order: 2,
    tints: { primary: "cloth" },
    colour: "#2e241c",
    paint:
    [
        { region: "legs", faces: Shared.SIDES, rows: [-16], stamp: "leather", tint: "primary" },
        { region: "legs", faces: Shared.SIDES, rows: [-16, -14], stamp: "leather", tint: { of: "primary", shade: 1.3 } },
        { region: "legs", faces: ["bottom"], stamp: "leather", tint: Shared.SOLE },
    ],
};
