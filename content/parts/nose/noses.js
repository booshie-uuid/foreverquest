const SKIN = [{ stamp: "grit.flat", tint: { of: "skin", shade: 0.95 } }];

const EYE_LINE = 8.5;
const TIP = 4.5;

// Each nose sits on the face. One up to 4 texels tall ends at TIP, just above
// the nostril shadow; a taller one starts at EYE_LINE, 2.5 texels above the
// eyes' row.
function nose(id, name, order, [width, height, depth])
{
    const bottom = Math.min(TIP, EYE_LINE - height);

    return { id, slot: "nose", name, order, blocks: [{ at: "head", size: [width, height, depth], centre: [0, bottom + height / 2, 8 + depth / 2], faces: { all: SKIN } }] };
}

export const PARTS =
[
    nose("straight", "Straight", 0, [2, 4, 1]),
    nose("small", "Small", 1, [2, 2, 1]),
    nose("broad", "Broad", 2, [4, 3, 1]),
    nose("hooked", "Hooked", 3, [2, 5, 2]),
    nose("long", "Long", 4, [2, 4, 3]),
];
