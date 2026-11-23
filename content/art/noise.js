function lattice(seed, x, z)
{
    let h = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ Math.imul(seed, 1274126177);

    h = Math.imul(h ^ (h >>> 13), 1274126177);

    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function smooth(t)
{
    return t * t * (3 - 2 * t);
}

// From 0 to 1, varying over `scale` columns.
export function value(seed, x, z, scale)
{
    const fx = x / scale;
    const fz = z / scale;
    const x0 = Math.floor(fx);
    const z0 = Math.floor(fz);
    const tx = smooth(fx - x0);
    const tz = smooth(fz - z0);
    const top = lattice(seed, x0, z0) * (1 - tx) + lattice(seed, x0 + 1, z0) * tx;
    const bottom = lattice(seed, x0, z0 + 1) * (1 - tx) + lattice(seed, x0 + 1, z0 + 1) * tx;

    return top * (1 - tz) + bottom * tz;
}

// From 0 to 1.
export function fractal(seed, x, z, scale, octaves)
{
    let total = 0;
    let weight = 1;
    let sum = 0;

    for(let octave = 0; octave < octaves; octave++)
    {
        total += value(seed + octave * 101, x, z, scale / 2 ** octave) * weight;
        sum += weight;
        weight /= 2;
    }

    return total / sum;
}
