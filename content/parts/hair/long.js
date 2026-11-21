const HAIR = [{ stamp: "cloth", tint: "hair" }];

export const PART =
{
    id: "long",
    slot: "hair",
    paint:
    [
        { region: "face", stamp: "hairline.full", place: "centre centre", tint: "hair" },
        { region: "scalp", faces: ["top"], stamp: "hair.long.top", place: "centre centre", tint: "hair" },
        { region: "scalp", faces: ["back"], stamp: "hair.long.back", place: "centre centre", tint: "hair" },
        { region: "scalp", faces: ["left"], stamp: "hair.long.left", place: "centre centre", tint: "hair" },
        { region: "scalp", faces: ["right"], stamp: "hair.long.right", place: "centre centre", tint: "hair" },
    ],
    blocks:
    [
        { at: "head", size: [18, 18, 3], centre: [0, 6, -8.8], faces: { all: HAIR } },
        { at: "head", mirror: "head", size: [2, 12, 12], centre: [8.9, 8, -1.5], faces: { all: HAIR } },
    ],
};
