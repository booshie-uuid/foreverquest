const ARRIVE_DISTANCE = 0.15;
const PASS_DISTANCE = 0.3;
const TURN_RATE = 10;
const GRAVITY = 20;
const MOVING_SPEED = 0.05;
const SHOVE_SPEED = 6;
const SHOVE_DECAY = 0.75;
const STILL = 0.01;

export class Entity
{
    constructor(id, appearance)
    {
        this.id = id;
        this.appearance = appearance;
        this.position = { x: 0, y: 0, z: 0 };
        this.heading = 0;
        this.desiredHeading = 0;
        this.speed = 0;
        this.isRunning = false;
        this.target = null;
        this.route = [];
        this.fallSpeed = 0;
        this.riding = null;
        this.direction = { x: 0, z: 0 };
        this.push = { x: 0, z: 0 };
        this.brain = null;
        this.construct = null;
    }

    get name()
    {
        return this.appearance.get("name");
    }

    get measures()
    {
        return this.appearance.body.measures;
    }

    get radius()
    {
        return this.measures.radius;
    }

    get moveSpeed()
    {
        return this.isRunning ? this.measures.run : this.measures.walk;
    }

    get isMoving()
    {
        return this.speed > MOVING_SPEED;
    }

    get isSteering()
    {
        return this.direction.x !== 0 || this.direction.z !== 0;
    }

    /* ORDERS *****************************************************************/

    placeAt(x, z, zone, heading = this.heading)
    {
        this.position = zone.openGround(x, z, this.radius);
        this.heading = heading;
        this.desiredHeading = heading;
    }

    // Stands at the point { x, y, z } as it is, as the bake placed a construct.
    placeOn(point, heading)
    {
        this.position = { x: point.x, y: point.y, z: point.z };
        this.heading = heading;
        this.desiredHeading = heading;
    }

    moveTo(point)
    {
        this.follow([point]);
    }

    follow(points)
    {
        const [first, ...rest] = points;

        this.target = { x: first.x, z: first.z };
        this.route = rest.map((point) => ({ x: point.x, z: point.z }));
        this.direction = { x: 0, z: 0 };
    }

    steer(x, z)
    {
        this.direction = { x, z };

        if(x !== 0 || z !== 0) { this.clearTarget(); }
    }

    stop()
    {
        this.clearTarget();
        this.direction = { x: 0, z: 0 };
    }

    clearTarget()
    {
        this.target = null;
        this.route = [];
    }

    face(point)
    {
        this.desiredHeading = Math.atan2(point.x - this.position.x, point.z - this.position.z);
    }

    turnTo(heading)
    {
        this.desiredHeading = heading;
    }

    // Pushes the entity along the unit direction (x, z), slowing over a few
    // ticks, and drops its route.
    shove(x, z)
    {
        this.push = { x: x * SHOVE_SPEED, z: z * SHOVE_SPEED };
        this.clearTarget();
    }

    // Moves the entity towards (x, z), as far as the zone lets it.
    nudge(x, z, zone)
    {
        const resolved = zone.resolveMove(this.position, { x, z }, this.radius);

        this.position = { ...this.position, x: resolved.x, z: resolved.z };
    }

    setRunning(isRunning)
    {
        this.isRunning = isRunning;
    }

    distanceTo(other)
    {
        return Math.hypot(other.position.x - this.position.x, other.position.z - this.position.z);
    }

    /* TICK *******************************************************************/

    // An entity that rides a mover goes where the mover carries it.
    tick(delta, zone)
    {
        if(this.riding)
        {
            this.speed = 0;
            this.turn(delta);
            return;
        }

        const own = this.desiredVelocity();
        const velocity = { x: own.x + this.push.x, z: own.z + this.push.z };
        const isMoving = velocity.x !== 0 || velocity.z !== 0;
        const length = Math.hypot(velocity.x, velocity.z);

        this.position = { ...this.position, y: zone.liftOut(this.position.x, this.position.z, this.position.y) };

        const from = this.position;
        const to = { x: from.x + velocity.x * delta, z: from.z + velocity.z * delta };
        const resolved = isMoving ? zone.resolveMove(from, to, this.radius) : { x: from.x, z: from.z, floor: zone.standAt(from.x, from.z, from.y, this.radius).floor };
        const moved = Math.hypot(resolved.x - from.x, resolved.z - from.z);

        if(isMoving && moved < length * delta * 0.1) { this.clearTarget(); }

        this.speed = delta > 0 ? moved / delta : 0;
        this.position = { x: resolved.x, y: this.settle(resolved.floor, delta), z: resolved.z };

        if(own.x !== 0 || own.z !== 0) { this.desiredHeading = Math.atan2(own.x, own.z); }

        this.push = Math.hypot(this.push.x, this.push.z) < STILL ? { x: 0, z: 0 } : { x: this.push.x * SHOVE_DECAY, z: this.push.z * SHOVE_DECAY };
        this.turn(delta);
    }

    desiredVelocity()
    {
        if(this.isSteering)
        {
            const length = Math.hypot(this.direction.x, this.direction.z);

            return { x: (this.direction.x / length) * this.moveSpeed, z: (this.direction.z / length) * this.moveSpeed };
        }

        if(!this.target) { return { x: 0, z: 0 }; }

        const offset = { x: this.target.x - this.position.x, z: this.target.z - this.position.z };
        const distance = Math.hypot(offset.x, offset.z);

        if(distance < (this.route.length > 0 ? PASS_DISTANCE : ARRIVE_DISTANCE))
        {
            this.target = this.route.shift() ?? null;

            return this.desiredVelocity();
        }

        const speed = Math.min(this.moveSpeed, distance * 8);

        return { x: (offset.x / distance) * speed, z: (offset.z / distance) * speed };
    }

    settle(floor, delta)
    {
        const y = this.position.y;

        if(floor >= y)
        {
            this.fallSpeed = 0;

            return floor;
        }

        this.fallSpeed += GRAVITY * delta;

        const fallen = y - this.fallSpeed * delta;

        if(fallen > floor) { return fallen; }

        this.fallSpeed = 0;

        return floor;
    }

    turn(delta)
    {
        const difference = Math.atan2(Math.sin(this.desiredHeading - this.heading), Math.cos(this.desiredHeading - this.heading));

        this.heading += difference * Math.min(1, delta * TURN_RATE);
    }
}
