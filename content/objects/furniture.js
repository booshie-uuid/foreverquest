import * as Shapes from "./shapes.js";

// Positions are fine cubes, 8 to a world cube's edge, from the object's lower
// corner: x along its length, y up and z across, with its front facing +z.
// Ornaments are a cube across and stand on a table, a bar or a shelf.

const PETALS = ["petalRed", "petalYellow", "petalWhite", "petalBlue"];

function bottle(object, [x, y, z], height, glass)
{
    object.box([x, y, z], [x + 3, y + height, z + 3], glass);
    object.box([x + 1, y + height, z + 1], [x + 2, y + height + 2, z + 2], glass);
    object.box([x + 1, y + height + 2, z + 1], [x + 2, y + height + 3, z + 2], "oldPlanks");
}

function mug(object, [x, y, z])
{
    object.box([x, y, z], [x + 3, y + 4, z + 3], "planks");
    object.box([x, y + 1, z], [x + 3, y + 2, z + 3], "iron");
    object.box([x + 3, y + 1, z + 1], [x + 4, y + 3, z + 2], "planks");
    object.box([x + 1, y + 3, z + 1], [x + 2, y + 4, z + 2], "sacking");
}

function book(object, [x, y, z], [w, h, d], cover)
{
    object.box([x, y, z], [x + w, y + h, z + d], cover);
    object.box([x + 1, y, z + 1], [x + w, y + h, z + d - 1], "linen");
}

// A flower on a stem `height` tall, its head a plus of petals.
function flower(object, [x, z], height, petal)
{
    object.box([x, 0, z], [x + 1, height, z + 1], "leaves");
    object.box([x, height, z], [x + 1, height + 1, z + 1], "petalYellow");

    for(const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { object.box([x + dx, height, z + dz], [x + dx + 1, height + 1, z + dz + 1], petal); }
}

export const OBJECTS =
{
    table:
    {
        cells: [4, 2, 3],
        build(table)
        {
            table.box([0, 13, 0], [32, 16, 24], "planks");
            table.box([2, 11, 2], [30, 13, 22], "timber");

            for(const x of [2, 28])
            {
                for(const z of [2, 20]) { table.box([x, 0, z], [x + 2, 11, z + 2], "timber"); }
            }
        },
    },
    bench:
    {
        cells: [4, 1, 1],
        build(bench)
        {
            bench.box([0, 5, 1], [32, 7, 7], "planks");

            for(const x of [3, 27]) { bench.box([x, 0, 2], [x + 2, 5, 6], "timber"); }
        },
    },
    stool:
    {
        cells: [1, 1, 1],
        build(stool)
        {
            Shapes.disc(stool, [4, 4], 3.2, [5, 7], "planks");

            for(const [x, z] of [[2, 2], [5, 2], [2, 5], [5, 5]]) { stool.box([x, 0, z], [x + 1, 5, z + 1], "timber"); }
        },
    },
    shelf:
    {
        cells: [4, 6, 1],
        build(shelf)
        {
            for(const x of [0, 30]) { shelf.box([x, 0, 0], [x + 2, 48, 8], "timber"); }

            shelf.box([2, 0, 0], [30, 48, 1], "oldPlanks");

            for(const y of [0, 14, 28, 42]) { shelf.box([2, y, 1], [30, y + 2, 8], "planks"); }

            bottle(shelf, [4, 2, 3], 6, "glassGreen");
            bottle(shelf, [8, 2, 3], 4, "glassBrown");
            bottle(shelf, [12, 2, 4], 7, "glassGreen");
            shelf.box([18, 2, 2], [28, 8, 7], "sacking");
            Shapes.disc(shelf, [7, 4.5], 3, [16, 22], "pottery");
            Shapes.disc(shelf, [14, 4.5], 2.5, [16, 20], "pottery");
            book(shelf, [19, 16, 2], [2, 8, 5], "banner");
            book(shelf, [21, 16, 2], [2, 9, 5], "petalBlue");
            book(shelf, [23, 16, 2], [3, 7, 5], "oldPlanks");
            book(shelf, [26, 16, 2], [2, 9, 5], "glassBrown");
            bottle(shelf, [5, 30, 3], 5, "glassBrown");
            bottle(shelf, [10, 30, 3], 7, "glassGreen");
            bottle(shelf, [15, 30, 3], 6, "glassBrown");
            mug(shelf, [21, 30, 2]);
            mug(shelf, [25, 30, 3]);
        },
    },
    bed:
    {
        cells: [3, 2, 6],
        build(bed)
        {
            bed.box([0, 0, 0], [24, 16, 2], "timber");
            bed.box([0, 0, 46], [24, 9, 48], "timber");

            for(const x of [0, 22]) { bed.box([x, 0, 2], [x + 2, 6, 46], "timber"); }

            bed.box([2, 4, 2], [22, 6, 46], "planks");
            bed.box([2, 6, 2], [22, 9, 46], "linen");
            bed.box([4, 9, 3], [20, 11, 10], "linen");
            bed.box([1, 7, 14], [23, 10, 45], "banner");
        },
    },
    bottles:
    {
        cells: [1, 1, 1],
        isSolid: false,
        build(bottles)
        {
            bottle(bottles, [0, 0, 1], 4, "glassGreen");
            bottle(bottles, [4, 0, 0], 3, "glassBrown");
            bottle(bottles, [3, 0, 4], 2, "glassGreen");
        },
    },
    mugs:
    {
        cells: [1, 1, 1],
        isSolid: false,
        build(mugs)
        {
            mug(mugs, [0, 0, 1]);
            mug(mugs, [4, 0, 4]);
        },
    },
    jug:
    {
        cells: [1, 1, 1],
        isSolid: false,
        build(jug)
        {
            Shapes.disc(jug, [4, 4], 2.6, [0, 5], "pottery");
            Shapes.disc(jug, [4, 4], 1.6, [5, 7], "pottery");
            jug.box([6, 2, 3], [7, 6, 5], "pottery");
            jug.box([1, 6, 3], [2, 7, 5], "pottery");
        },
    },
    books:
    {
        cells: [1, 1, 1],
        isSolid: false,
        build(books)
        {
            book(books, [1, 0, 1], [6, 2, 5], "banner");
            book(books, [1, 2, 2], [5, 2, 4], "petalBlue");
            book(books, [2, 4, 1], [5, 1, 5], "glassBrown");
        },
    },
    bowl:
    {
        cells: [1, 1, 1],
        isSolid: false,
        build(bowl)
        {
            Shapes.disc(bowl, [4, 4], 2, [0, 1], "pottery");
            Shapes.disc(bowl, [4, 4], 3.6, [1, 3], "pottery", 2.4);

            for(const [x, z] of [[3, 3], [4, 4], [3, 5], [5, 3]]) { bowl.box([x, 1, z], [x + 1, 3, z + 1], "apple"); }

            bowl.box([4, 3, 3], [5, 4, 5], "apple");
        },
    },
    candlestick:
    {
        cells: [1, 1, 1],
        lights: [[0, 0, 0]],
        build(candle)
        {
            Shapes.disc(candle, [4, 4], 2.5, [0, 1], "iron");
            candle.box([3, 1, 3], [5, 2, 5], "iron");
            candle.box([3, 2, 3], [5, 6, 5], "linen");
            candle.box([3, 6, 3], [5, 8, 5], "window");
        },
    },
    flowerPot:
    {
        cells: [1, 1, 1],
        isSolid: false,
        build(pot)
        {
            Shapes.disc(pot, [4, 4], 2.2, [0, 3], "pottery");
            Shapes.disc(pot, [4, 4], 1.6, [3, 4], "earth");
            flower(pot, [3, 3], 6, "petalRed");
            flower(pot, [5, 5], 5, "petalWhite");
        },
    },
    flowerBed:
    {
        cells: [4, 2, 2],
        build(bed)
        {
            bed.box([0, 0, 0], [32, 3, 16], "timber");
            bed.box([1, 0, 1], [31, 3, 15], "earth");

            for(let x = 3; x < 30; x += 4)
            {
                for(let z = 4; z < 14; z += 5) { flower(bed, [x + (z % 2), z], 7 + ((x + z) % 4), PETALS[(x + z) % PETALS.length]); }
            }
        },
    },
    wildflowers:
    {
        cells: [3, 1, 3],
        isSolid: false,
        build(patch)
        {
            const petals = ["petalYellow", "petalWhite", "petalYellow", "petalBlue", "petalWhite", "petalRed"];

            for(let i = 0; i < 16; i++)
            {
                const x = 1 + ((i * 7) % 22);
                const z = 1 + ((i * 11) % 22);

                flower(patch, [x, z], 3 + ((i * 5) % 4), petals[i % petals.length]);
            }

            for(let i = 0; i < 14; i++) { patch.box([(i * 5 + 3) % 23, 0, (i * 9 + 2) % 23], [(i * 5 + 3) % 23 + 1, 2 + (i % 3), (i * 9 + 2) % 23 + 1], "leaves"); }
        },
    },
    poppies:
    {
        cells: [3, 1, 3],
        isSolid: false,
        build(patch)
        {
            for(let i = 0; i < 14; i++)
            {
                const x = 1 + ((i * 9) % 22);
                const z = 1 + ((i * 13) % 22);

                flower(patch, [x, z], 4 + ((i * 3) % 3), i % 5 === 0 ? "petalWhite" : "petalRed");
            }

            for(let i = 0; i < 10; i++) { patch.box([(i * 7 + 4) % 23, 0, (i * 5 + 6) % 23], [(i * 7 + 4) % 23 + 1, 3, (i * 5 + 6) % 23 + 1], "leaves"); }
        },
    },
};
