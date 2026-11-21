import * as Shared from "../shared.js";

export const PART =
{
    id: "sabatons",
    slot: "feet",
    name: "Sabatons",
    order: 3,
    tints: { primary: "metal" },
    colour: "#7a7e85",
    paint:
    [
        { region: "legs", faces: Shared.SIDES, rows: [-9], stamp: "plate", tint: "primary" },
        { region: "legs", faces: ["bottom"], stamp: "plate", tint: { of: "primary", shade: 0.6 } },
    ],
};
