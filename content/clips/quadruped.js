const TAU = Math.PI * 2;
const KEYS = 24;

function keys(shape)
{
    return Array.from({ length: KEYS }, (value, i) => shape((i / KEYS) * TAU));
}

// Diagonal pairs move together: the front left with the back right.
function gait(reach, bob, wag, lift)
{
    return [
        { bone: "legFL", axis: "x", keys: keys((phase) => -reach * Math.sin(phase)) },
        { bone: "legBR", axis: "x", keys: keys((phase) => -reach * Math.sin(phase)) },
        { bone: "legFR", axis: "x", keys: keys((phase) => reach * Math.sin(phase)) },
        { bone: "legBL", axis: "x", keys: keys((phase) => reach * Math.sin(phase)) },
        { bone: "head", axis: "x", keys: keys((phase) => bob * Math.sin(phase * 2)) },
        { bone: "tail", axis: "y", keys: keys((phase) => wag * Math.sin(phase)) },
        { bone: "body", axis: "lift", keys: keys((phase) => lift * Math.abs(Math.cos(phase))) },
    ];
}

export const CLIPS =
{
    rig: "quadruped",
    locomotion: { walk: 2.0, run: 7.0, strideBox: "leg", stride: [3.2, 6.0] },
    idle:
    [
        { bone: "head", axis: "y", period: 7, keys: keys((phase) => 0.3 * Math.sin(phase)) },
        { bone: "head", axis: "x", period: 3.5, keys: keys((phase) => 0.05 * Math.sin(phase)) },
        { bone: "tail", axis: "y", period: 1.6, keys: keys((phase) => 0.25 * Math.sin(phase)) },
    ],
    walk: gait(0.45, 0.04, 0.2, 0.01),
    run: gait(0.85, 0.08, 0.1, 0.04),
    actions: {},
};
