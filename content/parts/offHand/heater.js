export const PART =
{
    id: "heater",
    slot: "offHand",
    name: "Heater Shield",
    order: 2,
    tints: { primary: "cloth", trim: "cloth" },
    colour: "#4a1a18",
    trimColour: "#9a917c",
    stance: "shield",
    blocks:
    [
        {
            at: "armL",
            size: [2, 22, 18],
            centre: ["arm.w/2 + 1.2", "-0.5*arm.h", 0],
            faces:
            {
                left: [{ stamp: "cloth", tint: "primary" }, { stamp: "heraldry.charge", place: "centre centre", tint: "trim" }, { stamp: "heraldry.cut", place: "centre centre" }],
                all: [{ stamp: "planks", tint: "#3a2a1d" }],
            },
        },
    ],
};
