import * as Shared from "../shared.js";

const CHAIN = { stamp: "chain", tint: "primary" };

export const PART =
{
    id: "mail",
    slot: "chest",
    paint:
    [
        { region: "torso", ...CHAIN },
        { region: "sleeves", faces: Shared.SIDES, ...CHAIN },
        { region: "arms", faces: ["top"], ...CHAIN },
        { region: "torso", faces: Shared.SIDES, rows: [-6, -4], stamp: "leather", tint: "trim" },
    ],
    blocks: [Shared.tails("chain", 10)],
};
