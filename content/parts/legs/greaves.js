import * as Shared from "../shared.js";

export const PART =
{
    id: "greaves",
    slot: "legs",
    name: "Greaves",
    order: 3,
    tints: { primary: "metal", trim: "cloth" },
    colour: "#7a7e85",
    trimColour: "#2a2a2a",
    paint:
    [
        { region: "legs", faces: [...Shared.SIDES, "top"], stamp: "cloth", tint: "trim" },
        { region: "legs", faces: Shared.SIDES, rows: [0.38], stamp: "plate", tint: "primary" },
        { region: "legs", faces: ["front"], rows: [0.38], stamp: "solid.3rows", place: "tile top", tint: { of: "primary", shade: 1.25 } },
    ],
    blocks: [{ at: "legL", mirror: "legR", size: ["leg.w + 1", 3, 2], centre: [0, "-0.45*leg.h", "leg.d/2 + 0.6"], faces: { all: [{ stamp: "plate", tint: { of: "primary", shade: 1.15 } }] } }],
};
