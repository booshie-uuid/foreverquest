// Texels. The mimic's rig: a base on four feet, and a lid hinged along the
// base's back edge, closed at rest.
export const RIG =
{
    id: "chest",
    boxes: ["base", "lid", "foot"],
    faceBone: "lid",
    bones:
    [
        { name: "base", parent: "root", box: "base", pivot: [0, "foot.h", 0], centre: [0, "base.h/2", 0] },
        { name: "lid", parent: "base", box: "lid", pivot: [0, "base.h", "-base.d/2"], centre: [0, "lid.h/2", "lid.d/2"] },
        { name: "footFL", parent: "base", box: "foot", pivot: ["base.w/2 - foot.w/2", 0, "base.d/2 - foot.d/2"], centre: [0, "-foot.h/2", 0] },
        { name: "footFR", mirror: "footFL" },
        { name: "footBL", parent: "base", box: "foot", pivot: ["base.w/2 - foot.w/2", 0, "foot.d/2 - base.d/2"], centre: [0, "-foot.h/2", 0] },
        { name: "footBR", mirror: "footBL" },
    ],
};
