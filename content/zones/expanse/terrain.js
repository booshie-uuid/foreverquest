import * as Noise from "../../art/noise.js";

const SEED = 9001;
const GRASS = 0;
const MOSS = 1;
const MUD = 2;
const SAND = 3;
const ROCK = 4;

// Slopes stay below one cell a column away from the peaks, so most of the
// zone can be walked.
export function column(zone, x, z)
{
    const centre = zone.columns / 2;
    const fromCentre = Math.hypot(x - centre, z - centre) / centre;
    const hills = Math.min(1, Math.max(0, (Noise.fractal(SEED, x, z, 700, 5) - 0.5) * 2.5 + 0.5));
    const ridges = 1 - Math.abs(Noise.fractal(SEED + 7, x, z, 500, 3) - 0.5) * 2;
    const height = hills * 44 + ridges ** 3 * 34;
    const meadow = Math.max(0, 1 - fromCentre * 6);
    const surface = Math.round(zone.base - 6 + height * (1 - meadow) + 16 * meadow);
    const damp = Noise.value(SEED + 13, x, z, 90);
    let ground = GRASS;

    if(surface - zone.base >= 54) { ground = ROCK; }
    else if(surface <= zone.water + 1) { ground = SAND; }
    else if(damp > 0.72) { ground = MUD; }
    else if(damp > 0.55) { ground = MOSS; }

    return [surface, ground];
}
