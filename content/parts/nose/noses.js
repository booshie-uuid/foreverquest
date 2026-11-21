const SKIN = [{ stamp: "grit.flat", tint: { of: "skin", shade: 0.95 } }];

// Each nose sits on the face, its top 2.5 texels above the eyes' row.
function nose(id, [width, height, depth])
{
    return { id, slot: "nose", blocks: [{ at: "head", size: [width, height, depth], centre: [0, 8.5 - height / 2, 8 + depth / 2], faces: { all: SKIN } }] };
}

export const PARTS =
[
    nose("straight", [2, 4, 1]),
    nose("small", [2, 2, 1]),
    nose("broad", [4, 3, 1]),
    nose("hooked", [2, 5, 2]),
    nose("long", [2, 4, 3]),
];
