import * as Shared from "../shared.js";

export const PART =
{
    id: "shoes",
    slot: "feet",
    name: "Shoes",
    order: 1,
    tints: { primary: "cloth" },
    colour: "#2e241c",
    paint:
    [
        { region: "legs", faces: Shared.SIDES, rows: [-5], stamp: "leather", tint: "primary" },
        { region: "legs", faces: ["bottom"], stamp: "leather", tint: Shared.SOLE },
    ],
};
