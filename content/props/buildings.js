import * as Kit from "../art/kit.js";

// Buildings from the building kit, in whole cubes; content/art/kit.js
// describes a spec.
export const BUILDINGS =
{
    cottage:
    {
        width: 16,
        depth: 12,
        storeys: 1,
        walls: { ground: "stone" },
        roof: { texture: "thatch", ridge: "x" },
        doors: [{ at: 0 }],
        windows: [{ side: "front", at: -4 }, { side: "front", at: 6 }, { side: "back", at: 0, isLit: false }],
    },
    house:
    {
        width: 22,
        depth: 18,
        storeys: 2,
        walls: { ground: "stone", upper: "plaster", frame: "timber" },
        roof: { texture: "slate", ridge: "x" },
        doors: [{ at: -4 }],
        windows: [{ at: 4 }, { at: -6, storey: 1 }, { at: 5, storey: 1, isLit: false }, { side: "right", at: 0 }, { side: "right", at: 0, storey: 1 }],
        stairs: [{ side: "left", storey: 0, from: -7 }],
    },
    townhouse:
    {
        width: 16,
        depth: 22,
        storeys: 3,
        walls: { ground: "stone", upper: "plaster", frame: "timber" },
        roof: { texture: "slate", ridge: "z" },
        doors: [{ at: -3 }],
        windows: [{ at: 4 }, { at: -4, storey: 1 }, { at: 4, storey: 1, isLit: false }, { at: -4, storey: 2, isLit: false }, { at: 4, storey: 2 }],
        lockedStairs: [{ side: "back", storey: 0, at: 2 }],
    },
};

export const PREFABS = Object.fromEntries(Object.entries(BUILDINGS).map(([id, spec]) => [id, Kit.building(spec)]));
