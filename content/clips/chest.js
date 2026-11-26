const TAU = Math.PI * 2;
const KEYS = 24;

// Keys sample one cycle evenly. A negative angle about x opens the lid.
function keys(shape)
{
    return Array.from({ length: KEYS }, (value, i) => shape((i / KEYS) * TAU));
}

function hop({ lift, lid, tilt })
{
    return [
        { bone: "base", axis: "lift", keys: keys((phase) => lift * Math.abs(Math.sin(phase))) },
        { bone: "base", axis: "x", keys: keys((phase) => tilt * Math.sin(phase)) },
        { bone: "lid", axis: "x", keys: keys((phase) => -lid * (1 + Math.sin(phase * 2)) / 2) },
    ];
}

const BREATH = TAU / 1.2;

export const CLIPS =
{
    rig: "chest",
    locomotion: { walk: 1.6, run: 3.2, strideBox: "base", stride: [1.5, 2.5] },
    idle:
    [
        { bone: "lid", axis: "x", period: BREATH, keys: keys((phase) => -0.16 - 0.06 * Math.sin(phase)) },
    ],
    walk: hop({ lift: 0.06, lid: 0.35, tilt: 0.08 }),
    run: hop({ lift: 0.12, lid: 0.6, tilt: 0.14 }),
    actions:
    {
        wake:
        {
            seconds: 1.4,
            fade: 0.2,
            channels:
            [
                { bone: "lid", axis: "x", period: 1.4, keys: keys((phase) => -1.1 * Math.sin(phase / 2)) },
                { bone: "base", axis: "z", period: 1.4, keys: keys((phase) => 0.08 * Math.sin(phase * 3)) },
            ],
        },
        shove:
        {
            seconds: 0.7,
            fade: 0.1,
            channels:
            [
                { bone: "lid", axis: "x", period: 0.7, keys: keys((phase) => -1.2 * Math.sin(phase / 2)) },
                { bone: "base", axis: "x", period: 0.7, keys: keys((phase) => 0.25 * Math.sin(phase / 2)) },
            ],
        },
    },
};
