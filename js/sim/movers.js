const CUBES_PER_METRE = 3;
const FINE_PER_METRE = 24;
const HEADROOM = 2;
const STANDING = 0.05;
const DEGREES = Math.PI / 180;


/******************************************************************************/
/* MOVER                                                                      */
/******************************************************************************/

// A placed object that moves along its track between end 0, where it was
// placed, and end 1. A spin turns without end.
export class Mover
{
    constructor(entry, block)
    {
        this.entry = entry;
        this.track = entry.mover;
        this.block = block;
        this.progress = 0;
        this.previous = 0;
        this.target = 0;
        this.isMoving = false;
        this.phase = 0;
        this.previousPhase = 0;
        this.waited = 0;
        this.riders = [];
    }

    get id()
    {
        return this.entry.id;
    }

    get isAtRest()
    {
        return !this.isMoving && this.progress === this.target;
    }

    // Whether its pose changed over the last tick.
    get hasMoved()
    {
        return this.track.spin !== undefined || this.progress !== this.previous;
    }

    setTarget(target)
    {
        this.target = target;
    }

    step(delta, zone, entities)
    {
        this.previous = this.progress;
        this.previousPhase = this.phase;

        if(this.track.spin)
        {
            this.phase += delta / this.track.spin.seconds;
            return;
        }

        if(this.progress === this.target) { return; }
        if(!this.isMoving && !this.start(zone, entities)) { return; }

        const towards = this.target > this.progress ? 1 : -1;

        this.progress = Math.max(0, Math.min(1, this.progress + (towards * delta) / this.track.seconds));
        this.carry();

        if(this.progress === this.target) { this.arrive(zone); }
    }

    // Claims the cells at the end it moves to, unless an entity that does not
    // ride it stands in one of them.
    start(zone, entities)
    {
        const [from, to] = this.ends();
        const claimed = new Set(from.map((cell) => cell.join()));
        const fresh = to.filter((cell) => !claimed.has(cell.join()));
        const riders = entities.filter((entity) => isOnTop(zone, entity, from));

        if(entities.some((entity) => !riders.includes(entity) && fresh.some((cell) => isInside(zone, entity, cell)))) { return false; }

        zone.setMoving(to, this.block);
        this.riders = riders;
        this.isMoving = true;

        for(const rider of riders) { rider.riding = this; }

        return true;
    }

    carry()
    {
        if(!this.track.slide) { return; }

        const eased = ease(this.progress) - ease(this.previous);
        const [dx, dy, dz] = this.track.slide.map((cubes) => (cubes / CUBES_PER_METRE) * eased);

        for(const rider of this.riders) { rider.position = { x: rider.position.x + dx, y: rider.position.y + dy, z: rider.position.z + dz }; }
    }

    arrive(zone)
    {
        const [from, to] = this.ends();

        zone.setMoving(from, 0);
        zone.setMoving(to, this.block);
        this.isMoving = false;

        for(const rider of this.riders) { rider.riding = null; }

        this.riders = [];
    }

    // The cells it leaves and the cells it moves to.
    ends()
    {
        const { cells, cellsMoved } = this.entry;

        return this.target === 1 ? [cells, cellsMoved] : [cellsMoved, cells];
    }

    // How far along its track the view draws it, `alpha` of the way from the
    // last tick to this one: a slide's offset in metres, or a turn's or a
    // spin's angle in radians about its axis through its pivot in metres.
    pose(alpha)
    {
        const track = this.track;

        if(track.spin)
        {
            const turns = this.previousPhase + (this.phase - this.previousPhase) * alpha;

            return { entry: this.entry, axis: track.spin.axis, pivot: null, angle: turns * Math.PI * 2 };
        }

        const eased = ease(this.previous + (this.progress - this.previous) * alpha);

        if(track.slide) { return { entry: this.entry, offset: track.slide.map((cubes) => (cubes / CUBES_PER_METRE) * eased) }; }

        const { axis, pivot, from = 0, degrees } = track.turn;

        return { entry: this.entry, axis, pivot: pivot.map((fine) => fine / FINE_PER_METRE), angle: (from + degrees * eased) * DEGREES };
    }
}

function ease(t)
{
    return t * t * (3 - 2 * t);
}

function isOnTop(zone, entity, cells)
{
    const [column, row] = zone.columnOf(entity.position.x, entity.position.z);
    const feet = zone.cellY(entity.position.y);

    return cells.some(([x, y, z]) => x === column && z === row && Math.abs(y + 1 - feet) < STANDING * CUBES_PER_METRE);
}

function isInside(zone, entity, [x, y, z])
{
    const bottom = zone.metresY(y);
    const feet = entity.position.y;

    return zone.touches(x, z, entity.position.x, entity.position.z, entity.radius) && feet < bottom + 1 / CUBES_PER_METRE && feet + HEADROOM > bottom;
}


/******************************************************************************/
/* MOVERS                                                                     */
/******************************************************************************/

// Every mover and trigger of a zone. A lever sends each of its movers to its
// other end when used, so two levers can work one mover; a plate sends them
// to end 1 while an entity stands on it. A mover with `near`
// goes to end 1 while an entity is within that many metres, and one with
// `every` goes to its other end after that many seconds at rest.
export class Movers
{
    constructor(zone)
    {
        const block = zone.blocks.number("object");

        this.zone = zone;
        this.movers = zone.objects.filter((entry) => entry.mover).map((entry) => new Mover(entry, block));
        this.triggers = zone.objects.filter((entry) => entry.trigger).map((entry) => ({ entry, isOn: false }));

        for(const mover of this.movers) { zone.setMoving(mover.entry.cells, block); }

        this.posed = new Set(this.movers);
    }

    mover(id)
    {
        return this.movers.find((mover) => mover.id === id) ?? null;
    }

    // The mover of `entry`, one of the zone's objects, or null.
    moverOf(entry)
    {
        return this.movers.find((mover) => mover.entry === entry) ?? null;
    }

    // Toggles the lever `entry`, one of the zone's objects; false when it is
    // not a lever.
    use(entry)
    {
        const trigger = this.triggers.find((each) => each.entry === entry && entry.trigger.lever);

        if(!trigger) { return false; }

        for(const id of entry.trigger.movers)
        {
            const mover = this.mover(id);

            mover?.setTarget(1 - mover.target);
        }

        return true;
    }

    tick(delta, entities)
    {
        for(const trigger of this.triggers.filter((each) => each.entry.trigger.plate))
        {
            const isOn = entities.some((entity) => isOnPlate(this.zone, entity, trigger.entry));

            if(isOn !== trigger.isOn)
            {
                trigger.isOn = isOn;
                this.send(trigger);
            }
        }

        for(const mover of this.movers)
        {
            const { near, every } = mover.track;

            if(near) { mover.setTarget(entities.some((entity) => Math.hypot(entity.position.x - mover.entry.x, entity.position.z - mover.entry.z) <= near) ? 1 : 0); }

            if(every && mover.isAtRest)
            {
                mover.waited += delta;

                if(mover.waited >= every)
                {
                    mover.waited = 0;
                    mover.setTarget(1 - mover.target);
                }
            }

            mover.step(delta, this.zone, entities);
        }
    }

    send(trigger)
    {
        for(const id of trigger.entry.trigger.movers) { this.mover(id)?.setTarget(trigger.isOn ? 1 : 0); }
    }

    // The poses of the movers that moved over the last tick, and once more of
    // each that stopped; the first call poses every mover.
    poses(alpha)
    {
        const moved = this.movers.filter((mover) => mover.hasMoved);
        const stopped = [...this.posed].filter((mover) => !moved.includes(mover));

        this.posed = new Set(moved);

        return [...moved, ...stopped].map((mover) => mover.pose(alpha));
    }

    dispose()
    {
        for(const mover of this.movers) { this.zone.setMoving([...mover.entry.cells, ...mover.entry.cellsMoved], 0); }
    }
}

function isOnPlate(zone, entity, entry)
{
    const [column, row] = zone.columnOf(entity.position.x, entity.position.z);
    const [x0, y0, z0, x1, , z1] = entry.box;

    return column >= x0 && column <= x1 && row >= z0 && row <= z1 && Math.abs(zone.cellY(entity.position.y) - y0) < 1;
}
