import * as Surfaces from "./art/surfaces.js";

export const SIZE = 64;
export const TEXELS_PER_METRE = 48;

// The layer order is the order in the baked atlas.
export const TEXTURES =
[
    { name: "grass", seed: 400, paint: (r, a, random) => Surfaces.grass(r, a, random) },
    { name: "moss", seed: 413, paint: (r, a, random) => Surfaces.grass(r, a, random, "#33381f") },
    { name: "mud", seed: 426, paint: (r, a, random) => Surfaces.mud(r, a, random) },
    { name: "cobble", seed: 439, paint: (r, a, random) => Surfaces.cobble(r, a, random) },
    { name: "earth", seed: 452, paint: (r, a, random) => Surfaces.earth(r, a, random) },
    { name: "sand", seed: 465, paint: (r, a, random) => Surfaces.sand(r, a, random) },
    { name: "stone", seed: 478, paint: (r, a, random) => Surfaces.stone(r, a, random, "#6a655c") },
    { name: "darkStone", seed: 491, paint: (r, a, random) => Surfaces.rubble(r, a, random, "#4e4a44") },
    { name: "grave", seed: 504, paint: (r, a, random) => Surfaces.slab(r, a, random, "#7a776e") },
    { name: "plaster", seed: 517, paint: (r, a, random) => Surfaces.plaster(r, a, random) },
    { name: "timber", seed: 530, paint: (r, a, random) => Surfaces.timber(r, a, random) },
    { name: "planks", seed: 543, paint: (r, a, random) => Surfaces.planks(r, a, random, "#4a3826") },
    { name: "oldPlanks", seed: 556, paint: (r, a, random) => Surfaces.planks(r, a, random, "#4a4640") },
    { name: "slate", seed: 569, paint: (r, a, random) => Surfaces.slate(r, a, random) },
    { name: "thatch", seed: 582, paint: (r, a, random) => Surfaces.thatch(r, a, random) },
    { name: "bark", seed: 595, paint: (r, a, random) => Surfaces.bark(r, a, random) },
    { name: "needles", seed: 608, paint: (r, a, random) => Surfaces.needles(r, a, random) },
    { name: "leaves", seed: 621, paint: (r, a, random) => Surfaces.leaves(r, a, random) },
    { name: "iron", seed: 634, paint: (r, a, random) => Surfaces.iron(r, a, random) },
    { name: "sacking", seed: 647, paint: (r, a, random) => Surfaces.weave(r, a, random, "#5e5446") },
    { name: "banner", seed: 660, paint: (r, a, random) => Surfaces.banner(r, a, random, "#4a1a18") },
    { name: "glow", seed: 673, glow: true, paint: (r, a, random) => Surfaces.glow(r, a, random) },
];
