const PLATE = { stamp: "plate", tint: "primary" };

export const PART =
{
    id: "circlet",
    slot: "head",
    name: "Circlet",
    order: 7,
    tints: { primary: "metal", trim: "cloth" },
    colour: "#8a7240",
    trimColour: "#4a1a18",
    blocks: [{ at: "head", size: [17, 2, 17], centre: [0, 12, 0], faces: { front: [PLATE, { stamp: "solid", place: "centre top", tint: "trim" }], all: [PLATE] } }],
};
