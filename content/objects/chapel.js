import * as Shapes from "./shapes.js";

// Positions are fine cubes, 8 to a world cube's edge, from the object's lower
// corner: x along its length, y up and z across. A thing that faces the nave
// faces +z.

function candle(object, [x, y, z], height)
{
    object.box([x, y, z], [x + 2, y + height, z + 2], "plaster");
    object.box([x, y + height, z], [x + 2, y + height + 2, z + 2], "window");
}

export const OBJECTS =
{
    cross:
    {
        cells: [2, 4, 2],
        build(cross)
        {
            cross.box([6, 0, 6], [10, 30, 10], "iron");
            cross.box([1, 19, 6], [15, 23, 10], "iron");
        },
    },
    banner:
    {
        cells: [2, 8, 1],
        build(banner)
        {
            banner.box([1, 0, 3], [4, 60, 6], "timber");
            banner.box([0, 60, 2], [5, 62, 7], "iron");
            banner.box([1, 62, 3], [4, 64, 6], "iron");
            banner.box([1, 56, 3], [16, 58, 5], "timber");

            for(let x = 4; x < 15; x++)
            {
                const notch = Math.max(0, 8 - Math.round(Math.abs(x + 0.5 - 9.5) * 1.6));

                banner.box([x, 20 + notch, 4], [x + 1, 56, 5], "banner");
                banner.box([x, 19 + notch, 4], [x + 1, 20 + notch, 5], "sacking");
            }

            for(const z of [3, 5])
            {
                banner.box([9, 30, z], [10, 50, z + 1], "plaster");
                banner.box([6, 42, z], [13, 44, z + 1], "plaster");
            }
        },
    },
    altar:
    {
        cells: [6, 5, 2],
        lights: [[1, 4, 1], [4, 4, 1]],
        build(altar)
        {
            altar.box([2, 0, 1], [46, 3, 15], "stone");
            altar.box([4, 3, 2], [44, 22, 14], "stone");
            altar.box([2, 22, 1], [46, 24, 15], "slab");
            altar.box([16, 24, 1], [32, 25, 15], "banner");
            altar.box([16, 10, 15], [32, 25, 16], "banner");
            altar.box([23, 13, 15], [25, 22, 16], "plaster");
            altar.box([20, 18, 15], [28, 20, 16], "plaster");
            altar.box([20, 25, 4], [28, 26, 11], "oldPlanks");
            altar.box([21, 26, 4], [27, 27, 11], "plaster");

            for(const x of [10, 36])
            {
                altar.box([x - 1, 24, 6], [x + 3, 25, 10], "iron");
                altar.box([x, 25, 7], [x + 2, 30, 9], "iron");
                altar.box([x - 1, 30, 6], [x + 3, 31, 10], "iron");
                candle(altar, [x, 31, 7], 5);
            }
        },
    },
    candelabra:
    {
        cells: [2, 6, 2],
        lights: [[1, 5, 1]],
        build(candelabra)
        {
            Shapes.disc(candelabra, [8, 8], 5, [0, 2], "iron");
            Shapes.disc(candelabra, [8, 8], 3, [2, 3], "iron");
            candelabra.box([7, 3, 7], [9, 36, 9], "iron");
            Shapes.disc(candelabra, [8, 8], 2, [18, 20], "iron");
            candelabra.box([2, 34, 7], [14, 36, 9], "iron");

            for(const x of [2, 7, 12])
            {
                candelabra.box([x, 36, 6], [x + 2, 37, 10], "iron");
                candle(candelabra, [x, 37, 7], x === 7 ? 7 : 5);
            }
        },
    },
    sconce:
    {
        cells: [1, 7, 1],
        lights: [[0, 6, 0]],
        build(sconce)
        {
            sconce.box([7, 40, 2], [8, 50, 6], "iron");
            sconce.box([4, 43, 3], [7, 44, 5], "iron");
            sconce.box([2, 44, 2], [6, 45, 6], "iron");
            candle(sconce, [3, 45, 3], 4);
        },
    },
    chandelier:
    {
        cells: [4, 6, 4],
        lights: [[3, 1, 2], [2, 1, 3], [0, 1, 2], [2, 1, 0]],
        build(chandelier)
        {
            chandelier.box([15, 6, 15], [17, 48, 17], "iron");
            Shapes.disc(chandelier, [16, 16], 12.6, [3, 4], "iron", 11.4);
            chandelier.box([4, 3, 15], [28, 4, 17], "iron");
            chandelier.box([15, 3, 4], [17, 4, 28], "iron");
            Shapes.disc(chandelier, [16, 16], 2, [1, 6], "iron");

            for(let i = 0; i < 8; i++)
            {
                const angle = (i / 8) * Math.PI * 2;
                const x = Math.round(16 + Math.cos(angle) * 12 - 1);
                const z = Math.round(16 + Math.sin(angle) * 12 - 1);

                candle(chandelier, [x, 4, z], 4);
            }
        },
    },
    pew:
    {
        cells: [6, 3, 2],
        build(pew)
        {
            for(const x of [0, 46])
            {
                pew.box([x, 0, 1], [x + 2, 22, 15], "timber");
                pew.box([x, 22, 3], [x + 2, 24, 13], "timber");
            }

            pew.box([2, 2, 6], [46, 4, 8], "timber");
            pew.box([2, 9, 1], [46, 11, 11], "planks");
            pew.box([2, 11, 12], [46, 21, 14], "planks");
            pew.box([2, 21, 11], [46, 23, 15], "timber");
        },
    },
    lectern:
    {
        cells: [2, 4, 2],
        build(lectern)
        {
            lectern.box([3, 0, 3], [13, 2, 13], "timber");
            lectern.box([6, 2, 6], [10, 24, 10], "timber");

            for(let z = 2; z < 14; z++)
            {
                const y = 24 + Math.floor((z - 2) / 2);

                lectern.box([2, y, z], [14, y + 2, z + 1], "oldPlanks");

                if(z >= 4 && z < 12) { lectern.box([4, y + 2, z], [12, y + 3, z + 1], "plaster"); }
            }
        },
    },
    runner:
    {
        cells: [4, 1, 8],
        isSolid: false,
        build(runner)
        {
            runner.box([3, 0, 0], [29, 1, 64], "banner");
            runner.box([5, 0, 0], [6, 1, 64], "plaster");
            runner.box([26, 0, 0], [27, 1, 64], "plaster");
        },
    },
};
