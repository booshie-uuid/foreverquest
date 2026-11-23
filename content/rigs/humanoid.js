// Texels. A pivot is in the parent bone's frame, and a centre places the
// bone's box in its own frame. The root is at the feet, +x is the character's
// left, and the bone order is the order the faces pack the sheet.
const GRIP = Math.PI / 2 + 0.55;
const HAND_ROWS = 5;

export const RIG =
{
    id: "humanoid",
    boxes: ["head", "torso", "arm", "leg"],
    faceBone: "head",
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
    sockets:
    [
        { name: "hand.L", bone: "armL", at: [0, "4 - arm.h", 0] },
        { name: "hand.R", bone: "armR", at: [0, "4 - arm.h", 0] },
        { name: "grip.L", bone: "armL", at: [0, "4 - arm.h", 0], rotation: [GRIP, 0, 0] },
        { name: "grip.R", bone: "armR", at: [0, "4 - arm.h", 0], rotation: [GRIP, 0, 0] },
        { name: "pole.L", bone: "armL", at: [0, "4 - arm.h", "arm.d/2 + 1.4"] },
        { name: "pole.R", bone: "armR", at: [0, "4 - arm.h", "arm.d/2 + 1.4"] },
    ],
    regions:
    {
        body: ["head", "torso", "armL", "armR", "legL", "legR"].map((bone) => ({ bone })),
        face: [{ bone: "head", faces: ["front"] }],
        scalp: [{ bone: "head", faces: ["top", "back", "left", "right"] }],
        torso: [{ bone: "torso" }],
        arms: [{ bone: "armL" }, { bone: "armR" }],
        sleeves: [{ bone: "armL", rows: [0, -HAND_ROWS] }, { bone: "armR", rows: [0, -HAND_ROWS] }],
        hands: [{ bone: "armL", rows: [-HAND_ROWS] }, { bone: "armR", rows: [-HAND_ROWS] }],
        legs: [{ bone: "legL" }, { bone: "legR" }],
    },
    slots: ["feature", "nose", "hair", "face", "beard", "markings", "legs", "feet", "chest", "hands", "head", "back", "mainHand", "offHand"],
    gear:
    [
        { id: "head", name: "Head" },
        { id: "chest", name: "Chest" },
        { id: "legs", name: "Legs" },
        { id: "feet", name: "Feet" },
        { id: "hands", name: "Hands" },
        { id: "back", name: "Back" },
        { id: "mainHand", name: "Main Hand" },
        { id: "offHand", name: "Off Hand" },
    ],
    held: ["mainHand", "offHand"],
    stances:
    {
        pole: { armR: { rest: -0.2, swing: 0.4 } },
        blade: { armR: { rest: -0.3, swing: 0.4 } },
        shield: { armL: { rest: -0.3, swing: 0.4 } },
        lantern: { armL: { rest: -0.7, swing: 0.4 } },
        dagger: { armL: { rest: 0, swing: 0.4 } },
    },
    base: [{ region: "body", stamp: "grit", tint: "skin" }],
};
