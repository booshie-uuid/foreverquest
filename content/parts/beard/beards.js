const BEARD = [{ stamp: "cloth", tint: { of: "hair", shade: 0.92 } }];
const BRAID = [{ stamp: "braid", tint: "hair" }];
const FULL = [{ region: "face", stamp: "beard.full", place: "centre centre", tint: "hair" }];
const CHIN = { at: "head", size: [14, 6, 3], centre: [0, 1, 9], faces: { all: BEARD } };

const BEARDS =
[
    { id: "none", slot: "beard", name: "None" },
    { id: "stubble", slot: "beard", name: "Stubble", paint: [{ region: "face", stamp: "beard.stubble", place: "centre centre", tint: { of: "skin", mix: "hair", amount: 0.3 } }] },
    { id: "moustache", slot: "beard", name: "Moustache", paint: [{ region: "face", stamp: "beard.moustache", place: "centre centre", tint: "hair" }] },
    { id: "short", slot: "beard", name: "Short", paint: FULL, blocks: [{ at: "head", size: [12, 3, 2], centre: [0, 1.5, 8.8], faces: { all: BEARD } }] },
    { id: "full", slot: "beard", name: "Full", paint: FULL, blocks: [CHIN] },
    { id: "long", slot: "beard", name: "Long", paint: FULL, blocks: [CHIN, { at: "head", size: [10, 12, 3], centre: [0, -7, 9.5], faces: { all: BRAID } }] },
    { id: "forked", slot: "beard", name: "Forked", paint: FULL, blocks: [CHIN, { at: "head", mirror: "head", size: [3, 10, 3], centre: [3, -6, 9.5], faces: { all: BRAID } }] },
];

export const PARTS = BEARDS.map((part, order) => ({ ...part, order }));
