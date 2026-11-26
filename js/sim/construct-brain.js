const SIGHT = 6;
const LEASH = 12;
const REACH = 0.35;
const SHOVE_SECONDS = 1.5;
const REPATH_SECONDS = 1;
const HOME_DISTANCE = 0.4;
const DEFAULT_WAKE_SECONDS = 1;


/******************************************************************************/
/* CONSTRUCT BRAIN                                                            */
/******************************************************************************/

// `sim` is the simulation, for the player, routes and events.
export class ConstructBrain
{
    constructor(actor, entry, sim, wakeSeconds = DEFAULT_WAKE_SECONDS)
    {
        this.actor = actor;
        this.entry = entry;
        this.sim = sim;
        this.wakeSeconds = wakeSeconds;
        this.home = { x: entry.x, z: entry.z, heading: actor.heading };
        this.state = "dormant";
        this.timer = 0;
        this.shoveTime = 0;
    }

    get isDormant()
    {
        return this.state === "dormant";
    }

    get leash()
    {
        return this.entry.leash ?? LEASH;
    }

    get sight()
    {
        return this.entry.wake?.near ?? SIGHT;
    }

    wake()
    {
        if(this.state !== "dormant") { return; }

        this.state = "waking";
        this.timer = this.wakeSeconds;
        this.sim.emit({ type: "woke", id: this.actor.id, name: this.actor.name });
    }

    tick(delta)
    {
        const player = this.sim.player;

        this.shoveTime = Math.max(0, this.shoveTime - delta);

        if(this.state === "dormant")
        {
            if(this.entry.wake?.near && this.actor.distanceTo(player) <= this.entry.wake.near) { this.wake(); }

            return;
        }

        if(this.state === "waking")
        {
            this.timer -= delta;
            this.actor.face(player.position);

            if(this.timer <= 0) { this.state = "pursuing"; }

            return;
        }

        if(this.state === "pursuing") { this.pursue(delta, player); }
        else if(this.state === "returning") { this.goHome(delta); }
        else if(this.isInSight(player)) { this.state = "pursuing"; }
    }

    isInSight(player)
    {
        return this.actor.distanceTo(player) <= this.sight && this.distanceFromHome(player) <= this.leash;
    }

    distanceFromHome(entity)
    {
        return Math.hypot(entity.position.x - this.home.x, entity.position.z - this.home.z);
    }

    pursue(delta, player)
    {
        const actor = this.actor;
        const reach = actor.radius + player.radius + REACH;

        if(this.distanceFromHome(actor) > this.leash || this.distanceFromHome(player) > this.leash)
        {
            this.state = "returning";
            this.timer = 0;
            return;
        }

        if(actor.distanceTo(player) <= reach)
        {
            actor.stop();
            actor.face(player.position);

            if(this.shoveTime === 0) { this.shove(player); }

            return;
        }

        this.timer -= delta;

        if(this.timer > 0 && actor.target) { return; }

        this.timer = REPATH_SECONDS;
        actor.setRunning(true);
        this.sim.route(actor, player.position);
    }

    shove(player)
    {
        const actor = this.actor;
        const away = { x: player.position.x - actor.position.x, z: player.position.z - actor.position.z };
        const length = Math.hypot(away.x, away.z) || 1;

        this.shoveTime = SHOVE_SECONDS;
        player.shove(away.x / length, away.z / length);
        this.sim.emit({ type: "shoved", id: actor.id, name: actor.name });
    }

    goHome(delta)
    {
        const actor = this.actor;

        if(this.distanceFromHome(actor) <= HOME_DISTANCE)
        {
            actor.stop();
            actor.turnTo(this.home.heading);
            this.state = "guarding";
            return;
        }

        this.timer -= delta;

        if(actor.target || this.timer > 0) { return; }

        this.timer = REPATH_SECONDS;
        actor.setRunning(false);
        this.sim.route(actor, this.home);
    }
}
