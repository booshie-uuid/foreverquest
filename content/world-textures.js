import * as Surfaces from "./art/surfaces.js";
import * as Weathering from "./art/weathering.js";

export const SIZE = 64;
export const TEXELS_PER_METRE = 48;

// The layer order is the order in the baked atlas. An overlay's alpha is the
// weathering level at which each texel appears; every other texture is opaque.
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
    { name: "embers", seed: 959, glow: true, paint: (r, a, random) => Surfaces.embers(r, a, random) },
    { name: "grassSide", seed: 686, paint: (r, a, random) => Surfaces.edged(r, a, random, Surfaces.earth, "#3f4428") },
    { name: "mossSide", seed: 699, paint: (r, a, random) => Surfaces.edged(r, a, random, Surfaces.earth, "#33381f") },
    { name: "rubble", seed: 712, paint: (r, a, random) => Surfaces.rubble(r, a, random, "#5e5a52") },
    { name: "water", seed: 725, paint: (r, a, random) => Surfaces.water(r, a, random) },
    { name: "plasterWorn", seed: 738, paint: (r, a, random) => Weathering.plasterWorn(r, a, random) },
    { name: "timberWorn", seed: 751, paint: (r, a, random) => Surfaces.timber(r, a, random, "#4a4238") },
    { name: "thatchWorn", seed: 764, paint: (r, a, random) => Surfaces.thatch(r, a, random, "#4e4a30") },
    { name: "petalRed", seed: 842, paint: (r, a, random) => Surfaces.plaster(r, a, random, "#a83238") },
    { name: "petalYellow", seed: 855, paint: (r, a, random) => Surfaces.plaster(r, a, random, "#d4aa3c") },
    { name: "petalWhite", seed: 868, paint: (r, a, random) => Surfaces.plaster(r, a, random, "#d6d2c6") },
    { name: "petalBlue", seed: 881, paint: (r, a, random) => Surfaces.plaster(r, a, random, "#4c5aa4") },
    { name: "glassGreen", seed: 894, paint: (r, a, random) => Surfaces.plaster(r, a, random, "#2e5a3c") },
    { name: "glassBrown", seed: 907, paint: (r, a, random) => Surfaces.plaster(r, a, random, "#6a3e1c") },
    { name: "pottery", seed: 920, paint: (r, a, random) => Surfaces.plaster(r, a, random, "#8c4a2c") },
    { name: "linen", seed: 933, paint: (r, a, random) => Surfaces.plaster(r, a, random, "#c4bca6") },
    { name: "apple", seed: 946, paint: (r, a, random) => Surfaces.plaster(r, a, random, "#9a2c22") },
    { name: "mossTop", seed: 777, overlay: true, paint: (r, a, random) => Weathering.mossTop(r, a, random) },
    { name: "mossEdge", seed: 790, overlay: true, paint: (r, a, random) => Weathering.mossEdge(r, a, random, true) },
    { name: "mossFoot", seed: 803, overlay: true, paint: (r, a, random) => Weathering.mossEdge(r, a, random, false) },
    { name: "grime", seed: 816, overlay: true, paint: (r, a, random) => Weathering.grime(r, a, random) },
    { name: "cracks", seed: 829, overlay: true, paint: (r, a, random) => Weathering.cracks(r, a, random) },
];
