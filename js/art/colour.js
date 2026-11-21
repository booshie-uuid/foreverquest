export function rgb(colour)
{
    if(Array.isArray(colour)) { return colour; }

    const value = parseInt(colour.slice(1), 16);

    return [(value >> 16) & 255, (value >> 8) & 255, value & 255, 255];
}

export function shade(colour, factor)
{
    const [r, g, b] = rgb(colour);
    const clamp = (channel) => Math.max(0, Math.min(255, Math.round(channel * factor)));

    return [clamp(r), clamp(g), clamp(b), 255];
}

export function mix(colourA, colourB, amount)
{
    const a = rgb(colourA);
    const b = rgb(colourB);

    return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * amount)).concat(255);
}
