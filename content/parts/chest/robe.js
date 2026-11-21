import * as Shared from "../shared.js";

const CLOTH = { stamp: "cloth", tint: "primary" };
const TRIM = { stamp: "cloth", tint: "trim" };

export const PART =
{
    id: "robe",
    slot: "chest",
    paint:
    [
        { region: "torso", ...CLOTH },
        { region: "sleeves", faces: Shared.SIDES, ...CLOTH },
        { region: "sleeves", faces: Shared.SIDES, rows: [-3], ...TRIM },
        { region: "arms", faces: ["top"], ...CLOTH },
        { region: "torso", faces: Shared.SIDES, rows: [0, 3], ...TRIM },
        { region: "torso", faces: Shared.SIDES, rows: [-9, -6], ...TRIM },
    ],
    blocks: [Shared.tails("cloth", "leg.h - 4", "2.5 - leg.h/2")],
};
