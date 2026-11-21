const TAU = Math.PI * 2;
const KEYS = 24;

// Keys sample one cycle evenly; the player interpolates between them and
// loops. A locomotion cycle is one stride, and an idle or action channel's
// cycle is its period in seconds.
function keys(shape)
{
    return Array.from({ length: KEYS }, (value, i) => shape((i / KEYS) * TAU));
}

function swing(bone, amount, axis = "x")
{
    return { bone, axis, keys: keys((phase) => amount * Math.sin(phase)) };
}

function constant(bone, axis, value)
{
    return { bone, axis, keys: [value] };
}

function stride({ legs, arms, lean, lift, cape, head })
{
    return [
        swing("legL", -legs),
        swing("legR", legs),
        swing("armR", -arms),
        swing("armL", arms),
        constant("armR", "z", -0.05),
        constant("armL", "z", 0.05),
        constant("torso", "x", lean),
        swing("torso", 0.06, "y"),
        { bone: "torso", axis: "lift", keys: keys((phase) => lift * Math.abs(Math.cos(phase))) },
        constant("head", "x", head),
        constant("cape", "x", cape),
    ];
}

const BREATH = TAU / 1.6;
const LOOK = TAU / 0.31;

export const CLIPS =
{
    rig: "humanoid",
    locomotion: { walk: 2.4, run: 5.2, strideBox: "leg", stride: [2.4, 4.0] },
    idle:
    [
        { bone: "torso", axis: "x", period: BREATH, keys: keys((phase) => 0.01 * Math.sin(phase)) },
        { bone: "head", axis: "y", period: LOOK, keys: keys((phase) => 0.35 * Math.sin(phase)) },
        { bone: "cape", axis: "x", period: BREATH, keys: keys((phase) => 0.06 + 0.02 * Math.sin(phase)) },
        { bone: "armR", axis: "z", period: BREATH, keys: keys((phase) => -0.05 - 0.01 * Math.sin(phase)) },
        { bone: "armL", axis: "z", period: BREATH, keys: keys((phase) => 0.05 + 0.01 * Math.sin(phase)) },
    ],
    walk: stride({ legs: 0.55, arms: 0.45, lean: 0.04, lift: 0.015, cape: 0.31, head: 0 }),
    run: stride({ legs: 0.9, arms: 0.85, lean: 0.18, lift: 0.045, cape: 0.76, head: -0.08 }),
    actions:
    {
        wave:
        {
            seconds: 2.2,
            fade: 0.3,
            channels:
            [
                constant("armR", "x", -0.2),
                { bone: "armR", axis: "z", period: TAU / 10, keys: keys((phase) => -2.6 + 0.3 * Math.sin(phase)) },
            ],
        },
    },
};
