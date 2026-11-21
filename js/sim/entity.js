const ARRIVE_DISTANCE = 0.15;
const TURN_RATE = 10;
const CLIMB_RATE = 14;
const MOVING_SPEED = 0.05;

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
        this.direction = { x: 0, z: 0 };
        this.brain = null;
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
        this.position = { x, y: zone.heightAt(x, z), z };
        this.heading = heading;
        this.desiredHeading = heading;
    }

    moveTo(point)
    {
        this.target = { x: point.x, z: point.z };
        this.direction = { x: 0, z: 0 };
    }

    steer(x, z)
    {
        this.direction = { x, z };

        if(x !== 0 || z !== 0) { this.target = null; }
    }

    stop()
    {
        this.target = null;
        this.direction = { x: 0, z: 0 };
    }

    face(point)
    {
        this.desiredHeading = Math.atan2(point.x - this.position.x, point.z - this.position.z);
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

    tick(delta, zone)
    {
        const velocity = this.desiredVelocity();
        const isMoving = velocity.x !== 0 || velocity.z !== 0;
        const length = Math.hypot(velocity.x, velocity.z);
        const from = { x: this.position.x, z: this.position.z };
        const to = { x: from.x + velocity.x * delta, z: from.z + velocity.z * delta };
        const resolved = isMoving ? zone.resolveStep(from, to, this.radius) : from;
        const moved = Math.hypot(resolved.x - from.x, resolved.z - from.z);

        if(isMoving && moved < length * delta * 0.1) { this.target = null; }

        this.speed = delta > 0 ? moved / delta : 0;
        this.position = { x: resolved.x, y: this.climb(zone.heightAt(resolved.x, resolved.z), delta), z: resolved.z };

        if(isMoving) { this.desiredHeading = Math.atan2(velocity.x, velocity.z); }

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

        if(distance < ARRIVE_DISTANCE)
        {
            this.target = null;

            return { x: 0, z: 0 };
        }

        const speed = Math.min(this.moveSpeed, distance * 8);

        return { x: (offset.x / distance) * speed, z: (offset.z / distance) * speed };
    }

    // The ground rises in quarter-metre steps.
    climb(ground, delta)
    {
        const difference = ground - this.position.y;

        if(Math.abs(difference) < 0.01) { return ground; }

        return this.position.y + difference * Math.min(1, delta * CLIMB_RATE);
    }

    turn(delta)
    {
        const difference = Math.atan2(Math.sin(this.desiredHeading - this.heading), Math.cos(this.desiredHeading - this.heading));

        this.heading += difference * Math.min(1, delta * TURN_RATE);
    }
}
