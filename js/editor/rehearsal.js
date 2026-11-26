const HOLD = 0.5;


/******************************************************************************/
/* REHEARSAL                                                                  */
/******************************************************************************/

// The movers played meet no entities, so nothing blocks or rides them.
export class Rehearsal
{
    constructor()
    {
        this.acts = [];
    }

    get isPlaying()
    {
        return this.acts.length > 0;
    }

    start(movers)
    {
        for(const mover of movers)
        {
            if(this.acts.some((act) => act.mover === mover)) { continue; }

            const home = mover.target;

            if(!mover.track.spin) { mover.setTarget(1 - home); }

            this.acts.push({ mover, home, rested: 0, turns: mover.phase + 1 });
        }
    }

    stop()
    {
        for(const act of this.acts) { act.mover.setTarget(act.home); }

        this.acts = [];
    }

    update(delta, zone)
    {
        for(const act of this.acts) { act.mover.step(delta, zone, []); }

        this.acts = this.acts.filter((act) => !this.isDone(act, delta));
    }

    isDone(act, delta)
    {
        const mover = act.mover;

        if(mover.track.spin) { return mover.phase >= act.turns; }
        if(!mover.isAtRest) { return false; }
        if(mover.target === act.home) { return true; }

        act.rested += delta;

        if(act.rested >= HOLD) { mover.setTarget(act.home); }

        return false;
    }
}
