import * as Noise from "../art/noise.js";


/******************************************************************************/
/* TERRAIN BASES                                                              */
/******************************************************************************/

// Each base gives the ground's height in metres above the zone's base cell,
// at a point given in metres from the zone's middle. Its settings describe
// the fields of the editor's terrain panel, where `detail` shows on hover.
export const BASES =
{
    flat:
    {
        label: "Flat",
        settings:
        [
            { key: "height", label: "Height", unit: "m", min: -5, max: 40, step: 0.5, value: 2 },
        ],
        height: (settings) => settings.height,
    },
    hills:
    {
        label: "Rolling hills",
        settings:
        [
            { key: "seed", label: "Seed", unit: "", min: 0, max: 99999, step: 1, value: 9001 },
            { key: "hills", label: "Hill height", unit: "m", min: 0, max: 40, step: 0.5, value: 5, detail: "How far the rolling hills rise above the lowest ground" },
            { key: "ridges", label: "Ridge crests", unit: "m", min: 0, max: 30, step: 0.5, value: 0, detail: "Adds narrow crests along winding lines on top of the hills, up to this height; 0 for none" },
            { key: "size", label: "Hill size", unit: "m", min: 60, max: 600, step: 10, value: 230, detail: "The usual distance from one hill to the next" },
        ],
        height: hills,
    },
};

function hills(settings, x, z)
{
    const swell = Noise.fractal(settings.seed, x, z, settings.size, 5);
    const rise = Math.min(1, Math.max(0, (swell - 0.5) * 2.5 + 0.5));
    const ridge = 1 - Math.abs(Noise.fractal(settings.seed + 7, x, z, settings.size * 0.72, 3) - 0.5) * 2;

    return rise * settings.hills + ridge ** 3 * settings.ridges;
}
