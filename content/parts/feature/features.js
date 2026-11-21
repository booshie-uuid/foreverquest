// Head blocks are in texels from the neck, with +x to the character's left.
const EAR = [{ stamp: "grit.flat", tint: { of: "skin", shade: 0.92 } }];

function ears(id, blocks)
{
    return { id, slot: "feature", blocks: blocks.map((block) => ({ at: "head", mirror: "head", faces: { all: EAR }, ...block })) };
}

export const PARTS =
[
    ears("earsRound", [{ size: [1, 3, 2], centre: [8.5, 8.5, -1] }]),
    ears("earsLong", [{ size: [1, 3, 2], centre: [8.5, 8.5, -1] }, { size: [1, 2, 6], centre: [9.1, 11, -3.5], rotation: [0.6, 0, -0.35] }]),
    ears("earsPointed", [{ size: [1, 4, 2], centre: [8.5, 9, -1], rotation: [0, 0, -0.35] }]),
    ears("earsSwept", [{ size: [2, 3, 4], centre: [9, 9, -2], rotation: [0, 0.5, -0.7] }]),
    {
        id: "tusks",
        slot: "feature",
        blocks: [{ at: "head", mirror: "head", size: [1, 3, 1], centre: [3, 3.5, 8.5], faces: { all: [{ stamp: "grit.flat", tint: "#cfc6ae" }] } }],
    },
];
