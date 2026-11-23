// Positions are fine cubes from the object's lower corner. A fine cube is
// filled when its centre lies inside the shape.

// A disc on the x-z plane from `bottom` up to, not including, `top`, with an
// optional hole. `blockAt(x, y, z, distance)` may choose each fine cube's block.
export function disc(object, [cx, cz], radius, [bottom, top], blockAt, hole = 0)
{
    const choose = typeof blockAt === "function" ? blockAt : () => blockAt;

    for(let y = bottom; y < top; y++)
    {
        for(let z = Math.floor(cz - radius); z < Math.ceil(cz + radius); z++)
        {
            for(let x = Math.floor(cx - radius); x < Math.ceil(cx + radius); x++)
            {
                const distance = Math.hypot(x + 0.5 - cx, z + 0.5 - cz);

                if(distance <= radius && distance >= hole) { object.set(x, y, z, choose(x, y, z, distance)); }
            }
        }
    }
}

export function ellipsoid(object, [cx, cy, cz], [rx, ry, rz], block)
{
    for(let y = Math.floor(cy - ry); y < Math.ceil(cy + ry); y++)
    {
        for(let z = Math.floor(cz - rz); z < Math.ceil(cz + rz); z++)
        {
            for(let x = Math.floor(cx - rx); x < Math.ceil(cx + rx); x++)
            {
                const dx = (x + 0.5 - cx) / rx;
                const dy = (y + 0.5 - cy) / ry;
                const dz = (z + 0.5 - cz) / rz;

                if(dx * dx + dy * dy + dz * dz <= 1) { object.set(x, y, z, block); }
            }
        }
    }
}

// A bar `thickness` fine cubes square on the x-y plane, stepping from one
// point to the other.
export function slant(object, [x0, y0], [x1, y1], [near, far], thickness, block)
{
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));

    for(let i = 0; i <= steps; i++)
    {
        const x = Math.round(x0 + ((x1 - x0) * i) / steps);
        const y = Math.round(y0 + ((y1 - y0) * i) / steps);

        object.box([x, y, near], [x + thickness, y + thickness, far], block);
    }
}
