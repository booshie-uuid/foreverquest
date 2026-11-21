const HAIR = [{ stamp: "cloth", tint: "hair" }];
const DARK = [{ stamp: "cloth", tint: { of: "hair", shade: 0.8 } }];
const BRAID = [{ stamp: "braid", tint: "hair" }];
const SIDES = ["top", "back", "left", "right"];

function scalp(family, top = family)
{
    return SIDES.map((side) => ({ region: "scalp", faces: [side], stamp: "hair." + (side === "top" ? top : family) + "." + side, place: "centre centre", tint: "hair" }));
}

function style(id, hairline, scalpLayers, blocks = [])
{
    const line = hairline ? [{ region: "face", stamp: "hairline." + hairline, place: "centre centre", tint: "hair" }] : [];

    return { id, slot: "hair", paint: [...line, ...scalpLayers], blocks: blocks.map((block) => ({ at: "head", faces: { all: HAIR }, ...block })) };
}

export const PARTS =
[
    style("bald", null, []),
    style("shaved", "stubble", scalp("shaved")),
    style("crop", "full", scalp("short")),
    style("swept", "swept", scalp("short"), [{ size: [16, 3, 10], centre: [0, 16.5, 1], rotation: [0.15, 0, 0] }]),
    style("long", "full", scalp("long"), [{ size: [18, 18, 3], centre: [0, 6, -8.8] }, { mirror: "head", size: [2, 12, 12], centre: [8.9, 8, -1.5] }]),
    style("tail", "full", scalp("short"), [{ size: [4, 4, 3], centre: [0, 11, -9.3], faces: { all: DARK } }, { size: [4, 14, 3], centre: [0, 2, -10], rotation: [0.12, 0, 0] }]),
    style("braids", "full", scalp("long"), [{ mirror: "head", size: [3, 16, 3], centre: [8.5, 3, 3], faces: { all: BRAID } }]),
    style("topknot", "full", scalp("short"), [{ size: [6, 5, 6], centre: [0, 18.5, -2], faces: { all: DARK } }, { size: [3, 4, 3], centre: [0, 22, -2] }]),
    style("crest", "stubble", scalp("shaved", "crest"), [{ size: [4, 4, 18], centre: [0, 17.5, 0] }]),
];
