import * as Fitter from "../kit/fitter.js";

const WAVE_SECONDS = 2.2;

export class Animator
{
    static WALK_SPEED = 2.4;
    static RUN_SPEED = 5.2;

    constructor(model)
    {
        this.model = model;
        this.phase = 0;
        this.time = 0;
        this.speed = 0;
        this.waveTime = 0;
    }

    wave()
    {
        this.waveTime = WAVE_SECONDS;
    }

    get isWaving()
    {
        return this.waveTime > 0;
    }

    update(delta, speed)
    {
        const plan = this.model.plan;

        if(plan.rig.motion !== "biped") { return; }

        const legLength = plan.boxes.leg[1] * Fitter.TEXEL * plan.scale;

        this.time += delta;
        this.speed += (speed - this.speed) * Math.min(1, delta * 10);
        this.waveTime = Math.max(0, this.waveTime - delta);

        const walk = Math.min(1, this.speed / Animator.WALK_SPEED);
        const run = Math.min(1, Math.max(0, (this.speed - Animator.WALK_SPEED) / (Animator.RUN_SPEED - Animator.WALK_SPEED)));
        const stride = legLength * (2.4 + run * 1.6);

        this.phase = (this.phase + (this.speed * delta / stride) * Math.PI * 2) % (Math.PI * 2);

        const pose = { walk, run, swing: Math.sin(this.phase), breath: Math.sin(this.time * 1.6) };

        this.poseBody(pose);
        this.poseArms(pose);

        if(this.waveTime > 0) { this.poseWave(); }
    }

    /* POSES ******************************************************************/

    poseBody({ walk, run, swing, breath })
    {
        const joints = this.model.joints;
        const legSwing = (0.55 + 0.35 * run) * walk * swing;
        const bounce = Math.abs(Math.cos(this.phase)) * (0.015 + 0.03 * run) * walk;

        joints.legL.rotation.set(-legSwing, 0, 0);
        joints.legR.rotation.set(legSwing, 0, 0);
        joints.torso.rotation.set(0.04 * walk + 0.14 * run + 0.01 * breath * (1 - walk), 0.06 * swing * walk, 0);
        joints.torso.position.y = this.model.plan.rest.torso.y + bounce;
        joints.head.rotation.set(-0.08 * run, 0.35 * Math.sin(this.time * 0.31) * (1 - walk), 0);
        joints.cape.rotation.set(0.06 + 0.25 * walk + 0.45 * run + 0.02 * breath, 0, 0);
    }

    poseArms({ walk, run, swing, breath })
    {
        const joints = this.model.joints;
        const look = this.model.appearance;
        const mainHand = look.equipped("mainHand").item;
        const offHand = look.equipped("offHand").item;
        const isPole = mainHand === "staff" || mainHand === "spear" || mainHand === "pitchfork";
        const armSwing = (0.45 + 0.4 * run) * walk * swing;
        const spread = 0.05 + 0.01 * breath * (1 - walk);

        const rightRest = mainHand === "none" ? 0 : isPole ? -0.2 : -0.3;
        const leftRest = offHand === "lantern" ? -0.7 : offHand === "none" || offHand === "dagger" ? 0 : -0.3;

        joints.armR.rotation.set(rightRest - armSwing * (mainHand === "none" ? 1 : 0.4), 0, -spread);
        joints.armL.rotation.set(leftRest + armSwing * (offHand === "none" ? 1 : 0.4), 0, spread);
    }

    poseWave()
    {
        const arm = this.model.joints.armR;
        const elapsed = WAVE_SECONDS - this.waveTime;
        const blend = Math.min(1, elapsed / 0.3, this.waveTime / 0.3);
        const wag = Math.sin(elapsed * 10) * 0.3;

        arm.rotation.x += (-0.2 - arm.rotation.x) * blend;
        arm.rotation.z += (-2.6 + wag - arm.rotation.z) * blend;
    }
}
