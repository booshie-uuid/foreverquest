const PLATE = { stamp: "plate", tint: "primary" };

export const PART =
{
    id: "helm",
    slot: "head",
    hidesHair: true,
    blocks:
    [
        {
            at: "head",
            size: [19, 20, 19],
            centre: [0, 9, 0],
            faces:
            {
                front: [PLATE, { stamp: "visor.slots", place: "centre centre" }, { stamp: "visor.nasal", place: "centre centre", tint: "trim" }],
                all: [PLATE],
            },
        },
        { at: "head", size: [15, 2, 15], centre: [0, 20, 0], faces: { all: [PLATE] } },
    ],
};
