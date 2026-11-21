import { Animator } from "../../js/character/animator.js";
import { Appearance } from "../../js/character/appearance.js";
import { CharacterModel } from "../../js/character/character-model.js";

const STEP = 1 / 60;
const SAMPLE_EVERY = 15;
const STEPS = 180;
const BONES = ["torso", "legL", "legR", "head", "armL", "armR", "cape"];

// Each case runs the animator for three seconds at a fixed speed and samples
// the joints every quarter of a second.
export const CASES =
[
    { label: "idle", look: {}, speed: 0 },
    { label: "half walk", look: {}, speed: 1.2 },
    { label: "walk", look: {}, speed: 2.4 },
    { label: "jog", look: { body: "dwarf" }, speed: 3.8 },
    { label: "run", look: {}, speed: 5.2 },
    { label: "pole and shield", look: { equipment: { mainHand: { item: "staff" }, offHand: { item: "heater" } } }, speed: 2.4 },
    { label: "lantern", look: { equipment: { mainHand: { item: "none" }, offHand: { item: "lantern" } } }, speed: 5.2 },
    { label: "dagger", look: { equipment: { offHand: { item: "dagger" } } }, speed: 0 },
    { label: "wave", look: {}, speed: 0, wave: true },
];

// `animate(model)` returns a function of (delta, speed), and `wave()` on it.
export function sample(library, entry, animate)
{
    const model = new CharacterModel(new Appearance(library, entry.look));
    const animator = animate(model);
    const samples = [];

    if(entry.wave) { animator.wave(); }

    for(let step = 1; step <= STEPS; step++)
    {
        animator.update(STEP, entry.speed);

        if(step % SAMPLE_EVERY !== 0) { continue; }

        const joints = {};

        for(const bone of BONES) { joints[bone] = model.joints[bone].rotation.toArray().slice(0, 3).map((value) => Math.round(value * 1e5) / 1e5); }

        samples.push({ time: Math.round(step * STEP * 100) / 100, joints, lift: Math.round((model.joints.torso.position.y - model.plan.rest.torso.y) * 1e5) / 1e5 });
    }

    model.dispose();

    return samples;
}

export function prototype(model)
{
    return new Animator(model);
}
