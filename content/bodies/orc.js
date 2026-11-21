import * as Shared from "./humanoid-shared.js";

export const BODY =
{
    id: "orc",
    name: "Orc",
    rig: "humanoid",
    order: 5,
    playable: true,
    surface: "outfit",
    boxes: { head: [16, 16, 16], torso: [28, 34, 15], arm: [10, 34, 10], leg: [14, 40, 15] },
    variants: [Shared.MALE, Shared.FEMALE],
    sliders: Shared.SLIDERS,
    measures: Shared.MEASURES,
    skins: ["#6a7a54", "#56664a", "#7a7a5a", "#5a5e50", "#4a5240"],
    features: ["earsSwept", "tusks"],
    ears: "swept",
    hasTusks: true,
};
