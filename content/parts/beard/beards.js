const BEARD = [{ stamp: "cloth", tint: { of: "hair", shade: 0.92 } }];
const BRAID = [{ stamp: "braid", tint: "hair" }];
const FULL = [{ region: "face", stamp: "beard.full", place: "centre centre", tint: "hair" }];
const CHIN = { at: "head", size: [14, 6, 3], centre: [0, 1, 9], faces: { all: BEARD } };

export const PARTS =
[
    { id: "none", slot: "beard" },
    { id: "stubble", slot: "beard", paint: [{ region: "face", stamp: "beard.stubble", place: "centre centre", tint: { of: "skin", mix: "hair", amount: 0.3 } }] },
    { id: "moustache", slot: "beard", paint: [{ region: "face", stamp: "beard.moustache", place: "centre centre", tint: "hair" }] },
    { id: "short", slot: "beard", paint: FULL, blocks: [{ at: "head", size: [12, 3, 2], centre: [0, 1.5, 8.8], faces: { all: BEARD } }] },
    { id: "full", slot: "beard", paint: FULL, blocks: [CHIN] },
    { id: "long", slot: "beard", paint: FULL, blocks: [CHIN, { at: "head", size: [10, 12, 3], centre: [0, -7, 9.5], faces: { all: BRAID } }] },
    { id: "forked", slot: "beard", paint: FULL, blocks: [CHIN, { at: "head", mirror: "head", size: [3, 10, 3], centre: [3, -6, 9.5], faces: { all: BRAID } }] },
];
