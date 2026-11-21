import * as Shared from "./humanoid-shared.js";

export const BODY =
{
    id: "human",
    name: "Human",
    rig: "humanoid",
    order: 1,
    playable: true,
    surface: "outfit",
    boxes: { head: [16, 16, 16], torso: [24, 32, 12], arm: [8, 32, 8], leg: [12, 40, 12] },
    variants: [Shared.MALE, Shared.FEMALE],
    sliders: Shared.SLIDERS,
    measures: Shared.MEASURES,
    skins: ["#c8ab94", "#b49a84", "#a5785e", "#9a7c5c", "#7a5a42", "#5c4234"],
    features: ["earsRound"],
};
