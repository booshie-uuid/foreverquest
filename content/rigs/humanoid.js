// Texels. A pivot is in the parent bone's frame, and a centre places the
// bone's box in its own frame. The root is at the feet, +x is the character's
// left, and the bone order is the order the faces pack the sheet.
export const RIG =
{
    id: "humanoid",
    boxes: ["head", "torso", "arm", "leg"],
    faceBone: "head",
    motion: "biped",
    bones:
    [
        { name: "head", parent: "torso", box: "head", pivot: [0, "torso.h", 0], centre: [0, "head.h/2", 0] },
        { name: "torso", parent: "root", box: "torso", pivot: [0, "leg.h", 0], centre: [0, "torso.h/2", 0] },
        { name: "armL", parent: "torso", box: "arm", pivot: ["torso.w/2 + arm.w/2", "torso.h - 2", 0], centre: [0, "2 - arm.h/2", 0] },
        { name: "armR", mirror: "armL" },
        { name: "legL", parent: "root", box: "leg", pivot: ["leg.w/2", "leg.h", 0], centre: [0, "-leg.h/2", 0] },
        { name: "legR", mirror: "legL" },
        { name: "cape", parent: "torso", pivot: [0, "torso.h - 1", "-torso.d/2 - 0.7"] },
    ],
};
