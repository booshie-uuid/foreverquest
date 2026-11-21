function hash(ix, iz, seed)
{
    let h = Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(seed, 2246822519);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;

    return (h >>> 0) / 4294967295;
}

function smooth(t)
{
    return t * t * (3 - 2 * t);
}

export function value(x, z, seed)
{
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    const fx = smooth(x - ix);
    const fz = smooth(z - iz);

    const a = hash(ix, iz, seed);
    const b = hash(ix + 1, iz, seed);
    const c = hash(ix, iz + 1, seed);
    const d = hash(ix + 1, iz + 1, seed);

    const top = a + (b - a) * fx;
    const bottom = c + (d - c) * fx;

    return top + (bottom - top) * fz;
}

export function fractal(x, z, seed, octaves = 4)
{
    let total = 0;
    let amplitude = 1;
    let frequency = 1;
    let weight = 0;

    for(let i = 0; i < octaves; i++)
    {
        total += value(x * frequency, z * frequency, seed + i * 31) * amplitude;
        weight += amplitude;
        amplitude *= 0.5;
        frequency *= 2.03;
    }

    return total / weight;
}

export function smoothstep(edge0, edge1, x)
{
    const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));

    return t * t * (3 - 2 * t);
}
