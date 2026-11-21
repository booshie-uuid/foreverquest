import * as THREE from "three";
import { Animator } from "../character/animator.js";
import { CharacterModel } from "../character/character-model.js";

const ARRIVE_DISTANCE = 0.15;
const TURN_RATE = 10;

export class Actor
{
    constructor(appearance)
    {
        this.appearance = appearance;
        this.model = new CharacterModel(appearance);
        this.animator = new Animator(this.model);
        this.position = new THREE.Vector3();
        this.heading = 0;
        this.desiredHeading = 0;
        this.speed = 0;
        this.isRunning = false;
        this.target = null;
        this.direction = new THREE.Vector2();
        this.brain = null;

        this.model.root.userData.actor = this;
    }

    get name()
    {
        return this.appearance.get("name");
    }

    get root()
    {
        return this.model.root;
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
        return this.speed > 0.05;
    }

    placeAt(x, z, world, heading = this.heading)
    {
        this.position.set(x, world.heightAt(x, z), z);
        this.heading = heading;
        this.desiredHeading = heading;
        this.syncRoot();
    }

    moveTo(point)
    {
        this.target = new THREE.Vector2(point.x, point.z);
        this.direction.set(0, 0);
    }

    steer(x, z)
    {
        this.direction.set(x, z);

        if(x !== 0 || z !== 0) { this.target = null; }
    }

    stop()
    {
        this.target = null;
        this.direction.set(0, 0);
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

    /* FRAME ******************************************************************/

    update(delta, world)
    {
        const velocity = this.desiredVelocity();
        const from = { x: this.position.x, z: this.position.z };
        const to = { x: from.x + velocity.x * delta, z: from.z + velocity.y * delta };
        const resolved = velocity.lengthSq() > 0 ? world.resolveStep(from, to, this.radius) : from;
        const moved = Math.hypot(resolved.x - from.x, resolved.z - from.z);

        if(velocity.lengthSq() > 0 && moved < velocity.length() * delta * 0.1) { this.target = null; }

        this.speed = delta > 0 ? moved / delta : 0;
        this.position.set(resolved.x, this.climb(world.heightAt(resolved.x, resolved.z), delta), resolved.z);

        if(velocity.lengthSq() > 0) { this.desiredHeading = Math.atan2(velocity.x, velocity.y); }

        this.turn(delta);
        this.animator.update(delta, this.speed);
        this.syncRoot();
    }

    desiredVelocity()
    {
        const velocity = new THREE.Vector2();

        if(this.direction.lengthSq() > 0)
        {
            velocity.copy(this.direction).normalize().multiplyScalar(this.moveSpeed);
        }
        else if(this.target)
        {
            const offset = new THREE.Vector2(this.target.x - this.position.x, this.target.y - this.position.z);

            if(offset.length() < ARRIVE_DISTANCE)
            {
                this.target = null;
            }
            else
            {
                velocity.copy(offset).normalize().multiplyScalar(Math.min(this.moveSpeed, offset.length() * 8));
            }
        }

        return velocity;
    }

    // The ground rises in quarter-metre steps.
    climb(ground, delta)
    {
        const difference = ground - this.position.y;

        if(Math.abs(difference) < 0.01) { return ground; }

        return this.position.y + difference * Math.min(1, delta * 14);
    }

    turn(delta)
    {
        const difference = Math.atan2(Math.sin(this.desiredHeading - this.heading), Math.cos(this.desiredHeading - this.heading));

        this.heading += difference * Math.min(1, delta * TURN_RATE);
    }

    syncRoot()
    {
        this.model.root.position.copy(this.position);
        this.model.root.rotation.y = this.heading;
    }

    dispose()
    {
        this.model.dispose();
    }
}
