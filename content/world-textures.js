import * as Pixels from "../js/art/pixels.js";

export const SIZE = 32;
export const TEXELS_PER_METRE = 16;

// The layer order is the order in the baked atlas.
export const TEXTURES =
[
    { name: "grass", seed: 400, paint: (r, a, random) => Pixels.grass(r, a, random) },
    { name: "moss", seed: 413, paint: (r, a, random) => Pixels.grass(r, a, random, "#33381f") },
    { name: "mud", seed: 426, paint: (r, a, random) => Pixels.mud(r, a, random) },
    { name: "cobble", seed: 439, paint: (r, a, random) => Pixels.cobble(r, a, random) },
    { name: "earth", seed: 452, paint: (r, a, random) => Pixels.earth(r, a, random) },
    { name: "sand", seed: 465, paint: (r, a, random) => Pixels.grit(r, a, "#5e5644", random, 0.2) },
    { name: "stone", seed: 478, paint: (r, a, random) => Pixels.stone(r, a, random, "#6a655c") },
    { name: "darkStone", seed: 491, paint: (r, a, random) => Pixels.stone(r, a, random, "#4e4a44") },
    { name: "grave", seed: 504, paint: (r, a, random) => Pixels.stone(r, a, random, "#7a776e") },
    { name: "plaster", seed: 517, paint: (r, a, random) => Pixels.plaster(r, a, random) },
    { name: "timber", seed: 530, paint: (r, a, random) => Pixels.timber(r, a, random) },
    { name: "planks", seed: 543, paint: (r, a, random) => Pixels.planks(r, a, random, "#4a3826") },
    { name: "oldPlanks", seed: 556, paint: (r, a, random) => Pixels.planks(r, a, random, "#4a4640") },
    { name: "slate", seed: 569, paint: (r, a, random) => Pixels.slate(r, a, random) },
    { name: "thatch", seed: 582, paint: (r, a, random) => Pixels.thatch(r, a, random) },
    { name: "bark", seed: 595, paint: (r, a, random) => Pixels.bark(r, a, random) },
    { name: "needles", seed: 608, paint: (r, a, random) => Pixels.needles(r, a, random) },
    { name: "leaves", seed: 621, paint: (r, a, random) => Pixels.needles(r, a, random, "#3a3f24") },
    { name: "iron", seed: 634, paint: (r, a, random) => Pixels.iron(r, a, random) },
    { name: "sacking", seed: 647, paint: (r, a, random) => Pixels.cloth(r, a, random, "#5e5446") },
    { name: "banner", seed: 660, paint: (r, a, random) => Pixels.cloth(r, a, random, "#4a1a18") },
    { name: "glow", seed: 673, glow: true, paint: (r, a, random) => Pixels.glow(r, a, random) },
];
