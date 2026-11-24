export const BLOCKS =
{
    stone: { faces: { all: "stone" }, weathers: ["moss", "grime", "cracks", "chips"] },
    rubble: { faces: { all: "rubble" }, weathers: ["moss", "grime", "cracks", "chips"] },
    slab: { faces: { all: "grave" }, weathers: ["moss", "grime", "cracks", "chips"] },
    plaster: { faces: { all: "plaster" }, weathers: ["grime", "cracks", "chips"], worn: "plasterWorn" },
    timber: { faces: { all: "timber" }, weathers: ["grime"], worn: "timberWorn" },
    planks: { faces: { all: "planks" }, weathers: ["grime"] },
    oldPlanks: { faces: { all: "oldPlanks" }, weathers: ["grime"] },
    slate: { faces: { all: "slate" }, weathers: ["moss", "chips"] },
    thatch: { faces: { all: "thatch" }, weathers: ["moss"], worn: "thatchWorn" },
    iron: { faces: { all: "iron" } },
    sacking: { faces: { all: "sacking" } },
    banner: { faces: { all: "banner" } },
    window: { faces: { all: "glow" }, light: 12 },
    object: { kind: "object" },
    objectLight: { kind: "object", light: 14 },
};
