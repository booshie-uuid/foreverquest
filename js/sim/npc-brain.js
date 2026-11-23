const TALK_SECONDS = 5;

export class NpcBrain
{
    constructor(actor, resident, random)
    {
        this.actor = actor;
        this.resident = resident;
        this.random = random;
        this.home = { x: resident.home[0], z: resident.home[1] };
        this.pause = random.range(0.5, 4);
        this.talkTime = 0;
        this.lineIndex = 0;
    }

    get role()
    {
        return this.resident.role ?? null;
    }

    get isTalking()
    {
        return this.talkTime > 0;
    }

    greet(other)
    {
        const lines = this.resident.lines;
        const line = lines[this.lineIndex % lines.length];

        this.lineIndex++;
        this.talkTime = TALK_SECONDS;
        this.actor.stop();
        this.actor.face(other.position);

        return line.replace("{name}", other.name);
    }

    tick(delta, zone)
    {
        const actor = this.actor;

        if(this.talkTime > 0)
        {
            this.talkTime -= delta;

            return;
        }

        if(actor.target) { return; }

        this.pause -= delta;

        if(this.pause > 0) { return; }

        this.pause = this.random.range(2, 7);

        const destination = this.pickDestination(zone);

        if(destination) { actor.moveTo(destination); }
    }

    pickDestination(zone)
    {
        for(let attempt = 0; attempt < 8; attempt++)
        {
            const angle = this.random.range(0, Math.PI * 2);
            const distance = this.random.range(1, this.resident.roam);
            const x = this.home.x + Math.cos(angle) * distance;
            const z = this.home.z + Math.sin(angle) * distance;
            const radius = this.actor.radius;

            if(zone.footingAt(x, z, zone.heightAt(x, z), radius) && zone.isClearOfColliders(x, z, radius)) { return { x, z }; }
        }

        return null;
    }
}
