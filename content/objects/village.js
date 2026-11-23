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
};
