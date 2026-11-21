import * as Shared from "../shared.js";

const CHAIN = { stamp: "chain", tint: "primary" };

export const PART =
{
    id: "mail",
    slot: "chest",
    name: "Mail Hauberk",
    order: 6,
    tints: { primary: "metal", trim: "cloth" },
    colour: "#7a7e85",
    trimColour: "#2e241c",
    paint:
    [
        { region: "torso", ...CHAIN },
        { region: "sleeves", faces: Shared.SIDES, ...CHAIN },
        { region: "arms", faces: ["top"], ...CHAIN },
        { region: "torso", faces: Shared.SIDES, rows: [-6, -4], stamp: "leather", tint: "trim" },
    ],
    blocks: [Shared.tails("chain", 10)],
};
