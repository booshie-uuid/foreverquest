export const BODY =
{
    id: "wolf",
    name: "Wolf",
    rig: "quadruped",
    order: 20,
    playable: false,
    surface: "placeholder",
    shades: { snout: 0.8, tail: 0.88, legFL: 0.84, legFR: 0.84, legBL: 0.84, legBR: 0.84 },
    boxes: { body: [14, 16, 44], head: [12, 12, 13], snout: [7, 6, 8], leg: [5, 22, 5], tail: [4, 4, 20] },
    variants: [{ id: "male", name: "Male", boxes: {} }],
    sliders: { height: { scale: 0.06 } },
    measures: { radius: 0.4, walk: 2.0, run: 7.0, nameplate: 0.3, focus: 0.7 },
    skins: ["#5a5650", "#3e3b36", "#7a746a"],
};
