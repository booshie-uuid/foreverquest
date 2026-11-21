import * as Shared from "../shared.js";

export const PART =
{
    id: "trousers",
    slot: "legs",
    name: "Trousers",
    order: 1,
    tints: { primary: "cloth" },
    colour: "#2e241c",
    paint: [{ region: "legs", faces: [...Shared.SIDES, "top"], stamp: "cloth", tint: "primary" }],
};
