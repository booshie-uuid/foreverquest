import * as Shared from "./humanoid-shared.js";

export const BODY =
{
    id: "halfling",
    name: "Halfling",
    rig: "humanoid",
    order: 4,
    playable: true,
    surface: "outfit",
    boxes: { head: [16, 16, 16], torso: [20, 24, 11], arm: [7, 22, 7], leg: [10, 24, 11] },
    variants: [Shared.MALE, Shared.FEMALE],
    sliders: Shared.SLIDERS,
    measures: Shared.MEASURES,
    skins: ["#c8ab94", "#b49a84", "#a5785e", "#7a5a42"],
    ears: "pointed",
};
