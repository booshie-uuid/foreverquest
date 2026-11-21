const PLATE = [{ stamp: "plate", tint: "primary" }];

export const PART =
{
    id: "kettle",
    slot: "head",
    blocks:
    [
        { at: "head", size: [30, 1.5, 30], centre: [0, 16.5, 0], faces: { all: PLATE } },
        { at: "head", size: [18, 6, 18], centre: [0, 19.5, 0], faces: { all: PLATE } },
        { at: "head", size: [14, 1.5, 14], centre: [0, 23, 0], faces: { all: PLATE } },
    ],
};
