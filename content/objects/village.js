import * as Shapes from "./shapes.js";

// Positions are fine cubes, 8 to a world cube's edge, from the object's lower
// corner: x along its length, y up and z across.

function wheel(object, centre, near, far)
{
    const [cx, cy] = centre;

    for(let y = cy - 8; y < cy + 8; y++)
    {
        for(let x = cx - 8; x < cx + 8; x++)
        {
            const dx = x + 0.5 - cx;
            const dy = y + 0.5 - cy;
            const distance = Math.hypot(dx, dy);
            const isTyre = distance <= 8 && distance > 6.4;
            const isSpoke = distance <= 6.4 && (Math.abs(dx) < 0.6 || Math.abs(dy) < 0.6 || Math.abs(Math.abs(dx) - Math.abs(dy)) < 0.8);
            const isHub = distance <= 1.6;

            if(!isTyre && !isSpoke && !isHub) { continue; }

            object.box([x, y, near], [x + 1, y + 1, far], isTyre ? "iron" : isHub ? "iron" : "timber");
        }
    }
}

function barrel(object)
{
    const height = 21;

    for(let y = 0; y <= height; y++)
    {
        const radius = 6.2 + 1.2 * Math.sin((Math.PI * (y + 0.5)) / height);
        const isBand = [3, 4, 16, 17].includes(y);
        const blockAt = (x, layer, z, distance) =>
        {
            const sector = Math.floor(((Math.atan2(z + 0.5 - 8, x + 0.5 - 8) + Math.PI) / (Math.PI * 2)) * 14);

            if(isBand && distance > radius - 0.4) { return "iron"; }
            if(distance < radius - 1.2) { return "oldPlanks"; }

            return sector % 2 === 0 ? "planks" : "oldPlanks";
        };

        Shapes.disc(object, [8, 8], radius + (isBand ? 0.6 : 0), [y, y + 1], blockAt, y === height ? radius - 1.3 : 0);
    }
}

// `size` is the crate's edge in fine cubes, centred in two cubes.
function crate(object, size)
{
    const a = (16 - size) / 2;
    const b = a + size;

    object.box([a + 2, 1, a + 2], [b - 2, size - 1, b - 2], "oldPlanks");

    for(let y = 2; y < size - 2; y++)
    {
        if((y - 2) % 4 === 3) { continue; }

        object.box([a + 1, y, a + 2], [a + 2, y + 1, b - 2], "oldPlanks");
        object.box([b - 2, y, a + 2], [b - 1, y + 1, b - 2], "oldPlanks");
        object.box([a + 2, y, a + 1], [b - 2, y + 1, a + 2], "oldPlanks");
        object.box([a + 2, y, b - 2], [b - 2, y + 1, b - 1], "oldPlanks");
    }

    for(const x of [a, b - 2])
    {
        for(const z of [a, b - 2]) { object.box([x, 0, z], [x + 2, size, z + 2], "timber"); }
    }

    for(const y of [0, size - 2])
    {
        for(const z of [a, b - 2]) { object.box([a, y, z], [b, y + 2, z + 2], "timber"); }
        for(const x of [a, b - 2]) { object.box([x, y, a], [x + 2, y + 2, b], "timber"); }
    }

    for(const z of [a, b - 1]) { Shapes.slant(object, [a + 2, 2], [b - 4, size - 4], [z, z + 1], 2, "timber"); }
}

function sack(object, centre, radii)
{
    const [x, y, z] = centre;
    const top = Math.round(y + radii[1]);

    Shapes.ellipsoid(object, centre, radii, "sacking");
    Shapes.disc(object, [x, z], 2, [top - 1, top + 2], "sacking");
    Shapes.disc(object, [x, z], 2.6, [top, top + 1], "timber", 1.5);
    Shapes.disc(object, [x, z], 3, [top + 2, top + 3], "sacking");
}

export const OBJECTS =
{
    cart:
    {
        cells: [7, 3, 4],
        build(cart)
        {
            cart.box([2, 9, 7], [38, 10, 25], "timber");
            cart.box([2, 10, 6], [38, 12, 26], "planks");
            cart.box([2, 12, 6], [38, 17, 8], "planks");
            cart.box([2, 12, 24], [38, 17, 26], "planks");
            cart.box([2, 12, 8], [4, 16, 24], "planks");

            for(const z of [7, 24]) { for(const x of [2, 19, 36]) { cart.box([x, 9, z], [x + 2, 18, z + 1], "timber"); } }

            cart.box([19, 7, 3], [21, 9, 29], "iron");
            wheel(cart, [20, 8], 1, 4);
            wheel(cart, [20, 8], 28, 31);

            for(const z of [10, 21])
            {
                for(let x = 38; x < 56; x++)
                {
                    const y = 10 - Math.floor((x - 38) / 3);

                    cart.box([x, y, z], [x + 1, y + 1, z + 1], "timber");
                }
            }

            cart.box([6, 12, 10], [15, 18, 18], "sacking");
            cart.box([17, 12, 15], [28, 17, 23], "sacking");
            cart.box([18, 17, 16], [26, 18, 22], "sacking");
        },
    },
    barrel:
    {
        cells: [2, 3, 2],
        build: barrel,
    },
    crateLarge:
    {
        cells: [2, 2, 2],
        build: (object) => crate(object, 16),
    },
    crate:
    {
        cells: [2, 2, 2],
        build: (object) => crate(object, 14),
    },
    crateSmall:
    {
        cells: [2, 2, 2],
        build: (object) => crate(object, 12),
    },
    sacks:
    {
        cells: [3, 3, 2],
        build(sacks)
        {
            sack(sacks, [6.5, 7, 8], [5.5, 7, 5.5]);
            sack(sacks, [17.5, 6, 8], [5.5, 6, 5.5]);
            Shapes.ellipsoid(sacks, [11, 17.5, 8], [8.5, 4.5, 5], "sacking");
            sacks.box([19, 16, 7], [22, 19, 9], "sacking");
            sacks.box([20, 16, 7], [21, 19, 9], "timber");
            sacks.box([22, 15, 6], [24, 20, 10], "sacking");
        },
    },
    stocks:
    {
        cells: [6, 4, 3],
        build(stocks)
        {
            const holes = [[14, 2.5], [24, 3.5], [34, 2.5]];
            const isHole = (x, y) => holes.some(([hx, radius]) => Math.hypot(x + 0.5 - hx, y - 22) < radius);

            stocks.box([3, 0, 4], [45, 4, 20], "oldPlanks");

            for(const x of [5, 39]) { stocks.box([x, 4, 10], [x + 4, 30, 14], "timber"); }

            for(let y = 16; y < 28; y++)
            {
                for(let x = 9; x < 39; x++)
                {
                    if(!isHole(x, y)) { stocks.box([x, y, 10], [x + 1, y + 1, 14], y < 22 ? "oldPlanks" : "planks"); }
                }
            }

            stocks.box([4, 30, 9], [44, 32, 15], "oldPlanks");
            stocks.box([23, 24, 9], [25, 27, 10], "iron");
        },
    },
    signpost:
    {
        cells: [5, 7, 1],
        build(signpost)
        {
            signpost.box([18, 0, 2], [22, 54, 6], "timber");
            signpost.box([17, 54, 1], [23, 56, 7], "iron");
            signpost.box([22, 44, 3], [37, 49, 5], "oldPlanks");
            signpost.box([37, 45, 3], [39, 48, 5], "oldPlanks");
            signpost.box([39, 46, 3], [40, 47, 5], "oldPlanks");
            signpost.box([3, 36, 3], [18, 41, 5], "oldPlanks");
            signpost.box([1, 37, 3], [3, 40, 5], "oldPlanks");
            signpost.box([0, 38, 3], [1, 39, 5], "oldPlanks");

            for(const z of [2, 5])
            {
                for(const [from, to] of [[25, 27], [28, 29], [30, 34]]) { signpost.box([from, 46, z], [to, 47, z + 1], "iron"); }
                for(const [from, to] of [[6, 9], [10, 12], [13, 16]]) { signpost.box([from, 38, z], [to, 39, z + 1], "iron"); }
            }
        },
    },
    lampPost:
    {
        cells: [3, 8, 1],
        light: [2, 6, 0],
        build(post)
        {
            post.box([1, 0, 1], [7, 3, 7], "stone");
            post.box([2, 3, 2], [6, 61, 6], "timber");
            post.box([3, 61, 3], [5, 63, 5], "iron");
            post.box([6, 57, 3], [20, 59, 5], "timber");
            Shapes.slant(post, [6, 48], [13, 55], [3, 5], 2, "timber");
            post.box([16, 55, 3], [18, 57, 5], "iron");
            post.box([13, 53, 0], [21, 55, 8], "iron");
            post.box([14, 45, 1], [20, 53, 7], "window");

            for(const x of [13, 20])
            {
                for(const z of [0, 7]) { post.box([x, 45, z], [x + 1, 53, z + 1], "iron"); }
            }

            post.box([13, 43, 0], [21, 45, 8], "iron");
            post.box([16, 41, 3], [18, 43, 5], "iron");
        },
    },
    well:
    {
        cells: [7, 8, 7],
        build(well)
        {
            const courseOf = (x, y, z) =>
            {
                const sector = Math.floor(((Math.atan2(z + 0.5 - 28, x + 0.5 - 28) + Math.PI) / (Math.PI * 2)) * 24);

                return (sector + Math.floor(y / 4) * 3) % 7 === 0 ? "rubble" : "stone";
            };

            Shapes.disc(well, [28, 28], 19, [0, 9], "water");
            Shapes.disc(well, [28, 28], 26, [0, 18], courseOf, 19);
            Shapes.disc(well, [28, 28], 27, [18, 20], "slab", 18);

            for(const x of [0, 52]) { well.box([x, 0, 26], [x + 4, 63, 30], "timber"); }

            well.box([4, 40, 26], [52, 44, 30], "timber");
            well.box([27, 27, 27], [29, 40, 29], "sacking");
            Shapes.disc(well, [28, 28], 4, [20, 27], "planks");
            Shapes.disc(well, [28, 28], 4.5, [24, 25], "iron");

            for(let k = 0; k < 14; k++)
            {
                well.box([0, 50 + k, 2 * k], [56, 51 + k, 2 * k + 3], "slate");
                well.box([0, 50 + k, 53 - 2 * k], [56, 51 + k, 56 - 2 * k], "slate");
            }

            well.box([0, 63, 25], [56, 64, 31], "timber");
        },
    },
};
