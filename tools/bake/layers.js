const COLOUR_PATTERN = /^#[0-9a-f]{6}$/;
const CHANNELS = ["skin", "hair", "eyes", "primary", "trim"];
const FACES = ["front", "back", "left", "right", "top", "bottom"];
const PLACES = { x: ["tile", "centre"], y: ["tile", "top", "bottom", "centre"] };

export function check(layer, rig, stamps, where, problems, isRegion)
{
    const stamp = stamps[layer.stamp];
    const tint = tintOf(layer.tint);
    const [x, y] = Array.isArray(layer.place) ? layer.place : (layer.place ?? "tile tile").split(" ");

    if(isRegion && !rig.regions[layer.region]) { problems.push(where + " uses a region the " + rig.id + " rig does not have: " + layer.region); }
    if(!stamp) { problems.push(where + " uses an unknown stamp: " + layer.stamp); return; }
    if(!PLACES.x.includes(x) || !PLACES.y.includes(y)) { problems.push(where + " has an unknown place: " + layer.place); }
    if(stamp.isTinted && !tint) { problems.push(where + " uses the tinted stamp " + layer.stamp + " without a tint"); }
    if(layer.tint !== undefined && !tint) { problems.push(where + " has an unknown tint: " + JSON.stringify(layer.tint)); }
    if(layer.faces && !layer.faces.every((face) => FACES.includes(face))) { problems.push(where + " names an unknown face"); }
    if(layer.rows && !layer.rows.every(Number.isInteger)) { problems.push(where + " needs whole-number rows"); }
}

function tintOf(value)
{
    if(value === undefined) { return null; }
    if(CHANNELS.includes(value)) { return { of: value }; }
    if(COLOUR_PATTERN.test(value)) { return { colour: value }; }

    const isChannel = CHANNELS.includes(value?.of);
    const isColour = COLOUR_PATTERN.test(value?.colour ?? "");
    const isMix = value?.mix === undefined || (COLOUR_PATTERN.test(value.mix) && Number.isFinite(value.amount));
    const isShade = value?.shade === undefined || Number.isFinite(value.shade);

    return (isChannel || isColour) && isMix && isShade ? value : null;
}

export function normalise(layer)
{
    return {
        region: layer.region ?? null,
        faces: layer.faces ?? null,
        rows: layer.rows ?? null,
        stamp: layer.stamp,
        place: (layer.place ?? "tile tile").split(" "),
        tint: tintOf(layer.tint),
        variants: layer.variants ?? null,
    };
}
