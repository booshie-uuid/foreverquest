// The body box runs along z, with the head at +z. Rest angles are radians
// about x, y and z.
export const RIG =
{
    id: "quadruped",
    boxes: ["body", "head", "snout", "leg", "tail"],
    faceBone: "head",
    bones:
    [
        { name: "body", parent: "root", box: "body", pivot: [0, "leg.h", 0], centre: [0, "body.h/2 - 1", 0] },
        { name: "head", parent: "body", box: "head", pivot: [0, "body.h - 3", "body.d/2 - 2"], centre: [0, "head.h/2 - 1", "head.d/2"] },
        { name: "snout", parent: "head", box: "snout", pivot: [0, 0, "head.d"], centre: [0, "snout.h/2", "snout.d/2"] },
        { name: "legFL", parent: "root", box: "leg", pivot: ["body.w/2 - leg.w/2", "leg.h", "body.d/2 - leg.d/2 - 2"], centre: [0, "-leg.h/2", 0] },
        { name: "legFR", mirror: "legFL" },
        { name: "legBL", parent: "root", box: "leg", pivot: ["body.w/2 - leg.w/2", "leg.h", "leg.d/2 + 2 - body.d/2"], centre: [0, "-leg.h/2", 0] },
        { name: "legBR", mirror: "legBL" },
        { name: "tail", parent: "body", box: "tail", pivot: [0, "body.h - 3", "-body.d/2"], centre: [0, 0, "-tail.d/2"], rest: [-0.55, 0, 0] },
    ],
};
