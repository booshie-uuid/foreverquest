import * as Shared from "./humanoid-shared.js";

export const BODY =
{
    id: "elf",
    name: "Elf",
    rig: "humanoid",
    order: 2,
    playable: true,
    surface: "outfit",
    boxes: { head: [16, 16, 16], torso: [22, 33, 11], arm: [7, 34, 7], leg: [11, 45, 11] },
    variants: [Shared.MALE, Shared.FEMALE],
    sliders: Shared.SLIDERS,
    measures: Shared.MEASURES,
    skins: ["#d0bca8", "#bfae9c", "#9a9aa4", "#6a6478", "#4a4458"],
    features: ["earsLong"],
};
