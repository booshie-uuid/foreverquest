import * as Kit from "../art/kit.js";

// Places each [object, x, y, z, angle] with its footprint's middle x and z
// cubes from the building's origin, standing y cubes up.
function furnish(details, entries)
{
    for(const [object, x, y, z, angle = 0] of entries) { details.object({ object, at: [x / 3, y / 3, z / 3], angle }); }
}

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
        windows: [{ side: "front", at: -4 }, { side: "front", at: 6 }, { side: "back", at: 0, isBoarded: true }],
        details(cottage)
        {
            furnish(cottage,
            [
                ["bed", -5.5, 0, -2], ["table", 3, 0, -2.5], ["stool", 5.5, 0, -2.5],
                ["candlestick", 1.5, 2, -2.5], ["flowerPot", 3.5, 2, -2.5], ["flowerBed", 4, 0, 7],
            ]);
        },
    },
    house:
    {
        width: 22,
        depth: 18,
        storeys: 2,
        walls: { ground: "stone", upper: "plaster", frame: "timber" },
        roof: { texture: "slate", ridge: "x" },
        doors: [{ at: -4 }],
        windows: [{ at: 4 }, { at: -6, storey: 1 }, { at: 5, storey: 1, isBoarded: true }, { side: "right", at: 0 }, { side: "right", at: 0, storey: 1 }],
        stairs: [{ side: "left", storey: 0, from: -4 }],
        details(house)
        {
            furnish(house,
            [
                ["table", 4, 0, -2.5], ["stool", 1.5, 0, -2.5], ["stool", 6.5, 0, -2.5], ["jug", 2.5, 2, -2.5], ["bowl", 4.5, 2, -2.5],
                ["shelf", 5, 0, -7.5], ["bed", 6.5, 10, -5], ["flowerBed", 4, 0, 10],
            ]);
        },
    },
    townhouse:
    {
        width: 16,
        depth: 22,
        storeys: 3,
        walls: { ground: "stone", upper: "plaster", frame: "timber" },
        roof: { texture: "slate", ridge: "z" },
        doors: [{ at: -3 }],
        windows: [{ at: 4 }, { at: -4, storey: 1 }, { at: 4, storey: 1, isBoarded: true }, { at: -4, storey: 2, isBoarded: true }, { at: 4, storey: 2 }],
        lockedStairs: [{ side: "back", storey: 0, at: 2, isFull: true, deep: 8 }],
        details(townhouse)
        {
            furnish(townhouse,
            [
                ["table", 2, 0, 0.5], ["stool", -1.5, 0, 0.5], ["stool", 4.5, 0, 0.5], ["books", 0.5, 2, 0.5], ["candlestick", 2.5, 2, 0.5],
                ["shelf", 6.5, 0, 4, -Math.PI / 2], ["flowerBed", 4, 0, 12],
            ]);
        },
    },
    inn:
    {
        width: 36,
        depth: 24,
        storeys: 2,
        walls: { ground: "stone", upper: "plaster", frame: "timber" },
        roof: { texture: "slate", ridge: "x" },
        doors: [{ at: 0 }],
        windows:
        [
            { at: -12 }, { at: -7 }, { at: 8 }, { at: 13 },
            { at: -12, storey: 1 }, { at: -5, storey: 1, isBoarded: true }, { at: 5, storey: 1 }, { at: 12, storey: 1, isBoarded: true },
            { side: "back", at: -8 }, { side: "back", at: -8, storey: 1 },
        ],
        stairs: [{ side: "left", storey: 0, from: -8 }],
        lockedStairs: [{ side: "back", storey: 1, at: 12, length: 8 }],
        details(inn)
        {
            inn.box([4, 0, -7], [14, 3, -5], "planks");
            inn.box([4, 3, -7], [14, 4, -5], "oldPlanks");
            furnish(inn,
            [
                ["bottles", 4.5, 4, -6.5], ["mugs", 7.5, 4, -6.5], ["jug", 10.5, 4, -6.5], ["candlestick", 12.5, 4, -6.5],
                ["shelf", 6, 0, -10.5], ["shelf", 12, 0, -10.5],
                ["table", -6, 0, 3.5], ["bench", -6, 0, 1.5], ["bench", -6, 0, 5.5], ["mugs", -7.5, 2, 3.5], ["candlestick", -5.5, 2, 3.5],
                ["table", 6, 0, 3.5], ["bench", 6, 0, 1.5], ["bench", 6, 0, 5.5], ["jug", 4.5, 2, 3.5], ["candlestick", 6.5, 2, 3.5],
                ["stool", 13.5, 0, 0.5], ["stool", 13.5, 0, -2.5],
                ["bed", -7.5, 10, -8], ["bed", 1.5, 10, -8], ["bed", 14.5, 10, -2],
            ]);
            inn.box([15, 0, -3], [17, 32, 3], "stone");
            inn.clear([15, 0, -1], [16, 3, 1]);
            inn.box([16, 0, -1], [17, 1, 1], "glow");

            for(const x of [-5, 7])
            {
                inn.box([x, 10, -11], [x + 1, 19, 1], "plaster");
                inn.clear([x, 10, -2], [x + 1, 17, 1]);
            }
        },
    },
    store:
    {
        width: 24,
        depth: 18,
        storeys: 2,
        walls: { ground: "stone", upper: "plaster", frame: "timber" },
        roof: { texture: "slate", ridge: "x" },
        doors: [{ at: -2 }, { side: "right", storey: 1, at: 3 }],
        windows: [{ at: 5, glass: "clearGlass" }, { at: -6, storey: 1 }, { at: 5, storey: 1, isBoarded: true }],
        outsideStairs: [{ side: "right", storey: 0, from: -8 }],
        details(store)
        {
            store.box([-6, 0, -4], [6, 3, -2], "planks");
            furnish(store,
            [
                ["shelf", -10.5, 0, -5, Math.PI / 2], ["shelf", -10.5, 0, -1, Math.PI / 2], ["shelf", -10.5, 0, 3, Math.PI / 2], ["shelf", 0, 0, -7.5],
                ["bottles", -4.5, 3, -3.5], ["books", -1.5, 3, -3.5], ["bowl", 1.5, 3, -3.5], ["candlestick", 4.5, 3, -3.5],
                ["crateLarge", -6, 10, -5], ["crate", -3, 10, -6], ["sacks", 4.5, 10, -6],
            ]);
        },
    },
    smithy:
    {
        width: 22,
        depth: 18,
        storeys: 1,
        walls: { ground: "stone" },
        roof: { texture: "slate", ridge: "x" },
        doors: [{ at: 0, width: 9 }],
        windows: [{ side: "left", at: 0, isBoarded: true }],
        details(smithy)
        {
            smithy.box([-9, 0, -8], [-4, 3, -3], "stone");
            smithy.box([-8, 3, -7], [-5, 4, -4], "embers");
            smithy.box([-8, 4, -8], [-5, 21, -5], "stone");
            smithy.box([2, 0, -4], [5, 2, -3], "iron");
        },
    },
    warehouse:
    {
        width: 30,
        depth: 22,
        storeys: 2,
        walls: { ground: "stone", upper: "oldPlanks", frame: "timber" },
        roof: { texture: "slate", ridge: "x" },
        doors: [{ at: -2, width: 5 }],
        windows: [{ at: -10, isBoarded: true }, { at: 9, storey: 1, isBoarded: true }, { side: "back", at: 0, storey: 1, glass: "grimyGlass" }],
        lifts: [{ storey: 1, box: [8, -6, 11, -3] }],
        details(warehouse)
        {
            warehouse.object({ object: "liftPlatform", at: [9.5 / 3, 0, -4.5 / 3], id: "hoist", mover: { slide: [0, 9, 0], seconds: 4 } });
            warehouse.object({ object: "leverBase", at: [12.5 / 3, 0, -1.5 / 3], trigger: { lever: true, movers: ["hoist", "hoistLever"] } });
            warehouse.object({ object: "leverHandle", at: [12.5 / 3, 1 / 3, -1.5 / 3], id: "hoistLever", mover: { turn: { axis: "x", pivot: [4, 0, 4], from: -40, degrees: 80 }, seconds: 0.4 } });
            warehouse.object({ object: "leverBase", at: [12.5 / 3, 10 / 3, -1.5 / 3], trigger: { lever: true, movers: ["hoist", "loftLever"] } });
            warehouse.object({ object: "leverHandle", at: [12.5 / 3, 11 / 3, -1.5 / 3], id: "loftLever", mover: { turn: { axis: "x", pivot: [4, 0, 4], from: -40, degrees: 80 }, seconds: 0.4 } });

            for(const x of [-12, -8, -4]) { warehouse.object({ object: "crateLarge", at: [(x + 1) / 3, 0, -8 / 3] }); }
        },
    },
    stable:
    {
        width: 30,
        depth: 22,
        storeys: 2,
        walls: { ground: "stone", upper: "oldPlanks", frame: "timber" },
        roof: { texture: "thatch", ridge: "x" },
        doors: [{ at: 0, width: 5 }],
        windows: [{ at: -10, isBoarded: true }, { at: 10, isBoarded: true }],
        lockedStairs: [{ side: "left", storey: 0, at: -2 }],
        details(stable)
        {
            for(const x of [-6, 0, 6, 12]) { stable.box([x, 0, -10], [x + 1, 4, -4], "planks"); }
        },
    },
    gatehouse:
    {
        width: 24,
        depth: 24,
        storeys: 2,
        walls: { ground: "stone" },
        roof: { texture: "stone", isFlat: true },
        doors: [{ at: 0, width: 4 }, { side: "back", at: 0, width: 4 }],
        windows: [{ at: -8, storey: 1, isBoarded: true }, { at: 9, storey: 1, glass: "grimyGlass" }, { side: "back", at: -8, storey: 1, glass: "grimyGlass" }, { side: "back", at: 9, storey: 1, isBoarded: true }],
        stairs: [{ side: "right", storey: 0, from: -8 }],
        details(gate)
        {
            for(const x of [-2, 3])
            {
                gate.box([x, 0, -11], [x + 1, 9, 11], "stone");
                gate.clear([x, 0, -1], [x + 1, 7, 2]);
            }

            gate.box([-4, 10, 7], [5, 19, 11], "stone");
            gate.clear([-1, 9, 9], [3, 18, 10]);
            gate.object({ object: "portcullis", at: [0.5 / 3, 0, 9.5 / 3], id: "portcullis", mover: { slide: [0, 9, 0], seconds: 2.5 } });
            gate.object({ object: "leverBase", at: [-5.5 / 3, 0, 4.5 / 3], trigger: { lever: true, movers: ["portcullis", "portcullisLever"] } });
            gate.object({ object: "leverHandle", at: [-5.5 / 3, 1 / 3, 4.5 / 3], id: "portcullisLever", mover: { turn: { axis: "x", pivot: [4, 0, 4], from: -40, degrees: 80 }, seconds: 0.4 } });
        },
    },
    watchtower:
    {
        width: 18,
        depth: 18,
        storeys: 4,
        walls: { ground: "stone" },
        roof: { texture: "stone", isFlat: true },
        doors: [{ at: 0 }],
        windows:
        [
            { at: -5, storey: 1, isBoarded: true }, { at: 5, storey: 2, isBoarded: true }, { at: 0, storey: 3 },
            { side: "back", at: 0, storey: 2 }, { side: "left", at: 0, storey: 3, isBoarded: true }, { side: "right", at: 4, storey: 1 },
        ],
        stairs: [{ side: "left", storey: 0, from: -4 }, { side: "right", storey: 1, from: -4 }, { side: "left", storey: 2, from: -4 }],
    },
    mill:
    {
        width: 24,
        depth: 22,
        storeys: 2,
        walls: { ground: "stone", upper: "plaster", frame: "timber" },
        roof: { texture: "thatch", ridge: "x" },
        doors: [{ at: 0 }],
        windows: [{ at: -7, glass: "grimyGlass" }, { at: 7, storey: 1, glass: "grimyGlass" }, { side: "back", at: 0, storey: 1, isBoarded: true }],
        stairs: [{ side: "right", storey: 0, from: -6 }],
        details(mill)
        {
            mill.object({ object: "millWheel", at: [-13 / 3, -4 / 3, 0], mover: { spin: { axis: "x", seconds: 10 } } });
            mill.box([-6, 0, -6], [-2, 3, -2], "stone");
        },
    },
    barn:
    {
        width: 30,
        depth: 22,
        storeys: 1,
        walls: { ground: "oldPlanks", frame: "timber" },
        roof: { texture: "thatch", ridge: "x" },
        doors: [{ at: 0, width: 7 }],
        windows: [{ side: "left", at: 0, isBoarded: true }],
        lamps: false,
    },
};

export const PREFABS = Object.fromEntries(Object.entries(BUILDINGS).map(([id, spec]) => [id, Kit.building(spec)]));
