export const FINE = 8;

const CUBE = 1 / 3;

// Texture coordinates come from a corner's fine position, as the cube mesher
// lays them for cells.
const DIRECTIONS =
[
    { axis: 0, sign: 1, u: 2, v: 1, side: "side", uv: ([, y, z]) => [-z, y] },
    { axis: 0, sign: -1, u: 2, v: 1, side: "side", uv: ([, y, z]) => [z, y] },
    { axis: 1, sign: 1, u: 0, v: 2, side: "top", uv: ([x, , z]) => [x, -z] },
    { axis: 1, sign: -1, u: 0, v: 2, side: "bottom", uv: ([x, , z]) => [x, z] },
    { axis: 2, sign: 1, u: 0, v: 1, side: "side", uv: ([x, y]) => [x, y] },
    { axis: 2, sign: -1, u: 0, v: 1, side: "side", uv: ([x, y]) => [-x, y] },
];


/******************************************************************************/
/* GRID                                                                       */
/******************************************************************************/

// The fine cubes are stored y, then z, then x, as pairs of a palette index and
// a count.
export function encode(data)
{
    const runs = [];

    for(let i = 0; i < data.length;)
    {
        let count = 1;

        while(i + count < data.length && data[i + count] === data[i]) { count++; }

        runs.push(data[i], count);
        i += count;
    }

    return runs;
}

export function decode({ cells, palette, runs })
{
    const size = cells.map((count) => count * FINE);
    const data = new Uint8Array(size[0] * size[1] * size[2]);
    let at = 0;

    for(let i = 0; i < runs.length; i += 2)
    {
        data.fill(runs[i], at, at + runs[i + 1]);
        at += runs[i + 1];
    }

    return { size, palette, data };
}

function filledAt({ size, data }, x, y, z)
{
    const [width, height, depth] = size;

    if(x < 0 || y < 0 || z < 0 || x >= width || y >= height || z >= depth) { return 0; }

    return data[(y * depth + z) * width + x];
}


/******************************************************************************/
/* MESH                                                                       */
/******************************************************************************/

// `facesOf(block)` gives a block's top, side and bottom texture names. The
// mesh is in metres from the object's lower corner.
export function mesh(grid, facesOf, uvPerMetre)
{
    const textures = [];
    const out = { positions: [], normals: [], uvs: [], layers: [], indices: [] };
    const perFine = uvPerMetre * (CUBE / FINE);
    const textureOf = (paletteIndex, side) =>
    {
        const name = facesOf(grid.palette[paletteIndex])[side];

        if(!textures.includes(name)) { textures.push(name); }

        return textures.indexOf(name);
    };

    for(const direction of DIRECTIONS)
    {
        const { axis, sign, u, v } = direction;
        const [sizeU, sizeV] = [grid.size[u], grid.size[v]];
        const mask = new Int32Array(sizeU * sizeV);

        for(let slice = 0; slice < grid.size[axis]; slice++)
        {
            for(let j = 0; j < sizeV; j++)
            {
                for(let i = 0; i < sizeU; i++)
                {
                    const at = [0, 0, 0];

                    at[axis] = slice;
                    at[u] = i;
                    at[v] = j;

                    const filled = filledAt(grid, ...at);

                    at[axis] += sign;
                    mask[j * sizeU + i] = filled !== 0 && filledAt(grid, ...at) === 0 ? textureOf(filled, direction.side) + 1 : 0;
                }
            }

            merge(out, mask, direction, slice, [sizeU, sizeV], perFine);
        }
    }

    return { textures, ...out };
}

function merge(out, mask, direction, slice, [sizeU, sizeV], perFine)
{
    for(let j = 0; j < sizeV; j++)
    {
        for(let i = 0; i < sizeU;)
        {
            const key = mask[j * sizeU + i];

            if(key === 0)
            {
                i++;
                continue;
            }

            let width = 1;
            let height = 1;

            while(i + width < sizeU && mask[j * sizeU + i + width] === key) { width++; }
            while(j + height < sizeV && rowMatches(mask, key, i, j + height, width, sizeU)) { height++; }

            for(let row = j; row < j + height; row++) { mask.fill(0, row * sizeU + i, row * sizeU + i + width); }

            addQuad(out, direction, key - 1, [slice, i, j, width, height], perFine);
            i += width;
        }
    }
}

function rowMatches(mask, key, i, j, width, sizeU)
{
    for(let k = i; k < i + width; k++) { if(mask[j * sizeU + k] !== key) { return false; } }

    return true;
}

function addQuad(out, direction, texture, [slice, i, j, width, height], perFine)
{
    const { axis, sign, u, v } = direction;
    const first = out.positions.length / 3;
    const normal = [0, 0, 0];

    normal[axis] = sign;

    for(const [cornerU, cornerV] of [[0, 0], [1, 0], [1, 1], [0, 1]])
    {
        const corner = [0, 0, 0];

        corner[axis] = slice + (sign > 0 ? 1 : 0);
        corner[u] = i + cornerU * width;
        corner[v] = j + cornerV * height;

        const [tu, tv] = direction.uv(corner);

        out.positions.push(...corner.map((value) => (value / FINE) * CUBE));
        out.normals.push(...normal);
        out.uvs.push(tu * perFine, tv * perFine);
        out.layers.push(texture);
    }

    const order = (v === (u + 1) % 3) === (sign > 0) ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];

    out.indices.push(...order.map((index) => first + index));
}
