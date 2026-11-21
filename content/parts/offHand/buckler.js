export const PART =
{
    id: "buckler",
    slot: "offHand",
    name: "Buckler",
    order: 1,
    tints: { primary: "metal", trim: "metal" },
    colour: "#4a4e56",
    trimColour: "#7a7e85",
    stance: "shield",
    blocks:
    [
        {
            at: "armL",
            size: [2, 12, 12],
            centre: ["arm.w/2 + 1.2", "-0.55*arm.h", 0],
            faces:
            {
                left: [{ stamp: "plate", tint: "trim" }, { stamp: "boss.field", place: "centre centre", tint: "primary" }, { stamp: "solid.4", place: "centre centre", tint: { of: "trim", shade: 1.3 } }],
                all: [{ stamp: "plate", tint: "trim" }],
            },
        },
    ],
};
