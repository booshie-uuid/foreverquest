import * as Shared from "./humanoid-shared.js";

export const BODY =
{
    id: "ogre",
    name: "Ogre",
    rig: "humanoid",
    order: 10,
    playable: false,
    surface: "placeholder",
    shades: { head: 1.06, armL: 0.94, armR: 0.94, legL: 0.82, legR: 0.82 },
    boxes: { head: [22, 22, 22], torso: [40, 46, 22], arm: [15, 50, 15], leg: [20, 44, 22] },
    variants: [Shared.MALE],
    sliders: Shared.SLIDERS,
    measures: { radius: 0.55, walk: 2.0, run: 4.4, nameplate: 0.36, focus: 1.9 },
    skins: ["#6e6a52", "#5a5844", "#7a6e5a"],
};
