import * as Fitter from "./fitter.js";

const SMOOTHING = 10;


/******************************************************************************/
/* SAMPLING                                                                   */
/******************************************************************************/

// Samples looping keys at t cycles, with a Catmull-Rom spline through them.
export function sample(keys, t)
{
    const count = keys.length;

    if(count === 1) { return keys[0]; }

    const x = (((t % 1) + 1) % 1) * count;
    const i = Math.floor(x);
    const f = x - i;
    const [p0, p1, p2, p3] = [-1, 0, 1, 2].map((offset) => keys[(i + offset + count) % count]);

    return 0.5 * (2 * p1 + (p2 - p0) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (3 * p1 - p0 - 3 * p2 + p3) * f * f * f);
}


/******************************************************************************/
/* CLIP PLAYER                                                                */
/******************************************************************************/

export class ClipPlayer
{
    constructor(model)
    {
        this.model = model;
        this.phase = 0;
        this.time = 0;
        this.speed = 0;
        this.action = null;
    }

    get clips()
    {
        return this.model.appearance.library.clips(this.model.plan.rig.id);
    }

    get speeds()
    {
        const motion = this.clips?.locomotion;

        return motion ? { walk: motion.walk, run: motion.run } : null;
    }

    play(name)
    {
        const action = this.clips?.actions[name];

        if(action) { this.action = { name, action, remaining: action.seconds }; }
    }

    wave()
    {
        this.play("wave");
    }

    get isWaving()
    {
        return this.action?.name === "wave";
    }

    /* FRAME ******************************************************************/

    update(delta, speed)
    {
        const clips = this.clips;

        if(!clips) { return; }

        const motion = clips.locomotion;
        const plan = this.model.plan;

        this.time += delta;
        this.speed += (speed - this.speed) * Math.min(1, delta * SMOOTHING);

        if(this.action) { this.action.remaining = Math.max(0, this.action.remaining - delta); }

        const walk = Math.min(1, this.speed / motion.walk);
        const run = Math.min(1, Math.max(0, (this.speed - motion.walk) / (motion.run - motion.walk)));
        const legLength = plan.boxes[motion.strideBox][1] * Fitter.TEXEL * plan.scale;
        const stride = legLength * (motion.stride[0] + run * (motion.stride[1] - motion.stride[0]));

        this.phase = (this.phase + (this.speed * delta) / stride) % 1;

        const pose = new Map();
        const swings = this.stanceSwings();

        this.add(pose, clips.idle, 1 - walk, (channel) => this.time / channel.period, null);
        this.add(pose, clips.walk, walk * (1 - run), () => this.phase, swings);
        this.add(pose, clips.run, walk * run, () => this.phase, swings);
        this.apply(pose);
        this.overlay();
    }

    add(pose, channels, weight, cycle, swings)
    {
        if(weight <= 0) { return; }

        for(const channel of channels)
        {
            const key = channel.bone + "." + channel.axis;
            const factor = swings?.get(key) ?? 1;

            pose.set(key, (pose.get(key) ?? 0) + weight * factor * sample(channel.keys, cycle(channel)));
        }
    }

    stanceSwings()
    {
        const swings = new Map();

        for(const [bone, stance] of this.stances()) { swings.set(bone + ".x", stance.swing); }

        return swings;
    }

    stances()
    {
        const look = this.model.appearance;
        const rig = this.model.plan.rig;
        const held = [];

        for(const slot of rig.held)
        {
            const stance = look.equipped(slot)?.item && look.library.part(slot, look.equipped(slot).item)?.stance;

            for(const [bone, entry] of Object.entries(rig.stances[stance] ?? {})) { held.push([bone, entry]); }
        }

        return held;
    }

    apply(pose)
    {
        const plan = this.model.plan;
        const rests = new Map(this.stances().map(([bone, entry]) => [bone, entry.rest]));

        for(const bone of plan.fit.bones)
        {
            const node = this.model.joints[bone.name];
            const value = (axis) => pose.get(bone.name + "." + axis) ?? 0;

            node.rotation.set(bone.rest[0] + (rests.get(bone.name) ?? 0) + value("x"), bone.rest[1] + value("y"), bone.rest[2] + value("z"));
            node.position.y = plan.rest[bone.name].y + value("lift");
        }
    }

    overlay()
    {
        if(!this.action) { return; }

        const { action, remaining } = this.action;

        if(remaining <= 0)
        {
            this.action = null;
            return;
        }

        const elapsed = action.seconds - remaining;
        const blend = action.fade > 0 ? Math.min(1, elapsed / action.fade, remaining / action.fade) : 1;

        for(const channel of action.channels)
        {
            const node = this.model.joints[channel.bone];
            const target = sample(channel.keys, channel.period ? elapsed / channel.period : 0);

            if(channel.axis === "lift") { continue; }

            node.rotation[channel.axis] += (target - node.rotation[channel.axis]) * blend;
        }
    }
}
