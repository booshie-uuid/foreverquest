import * as Shared from "./humanoid-shared.js";

export const BODY =
{
    id: "dwarf",
    name: "Dwarf",
    rig: "humanoid",
    order: 3,
    playable: true,
    surface: "outfit",
    boxes: { head: [16, 16, 16], torso: [28, 28, 16], arm: [10, 26, 10], leg: [14, 24, 16] },
    variants: [Shared.MALE, Shared.FEMALE],
    sliders: Shared.SLIDERS,
    measures: Shared.MEASURES,
    skins: ["#b08a70", "#a07a62", "#8a6450", "#6a4a3a"],
    ears: "round",
};
