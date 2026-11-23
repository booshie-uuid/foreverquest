import * as THREE from "three";

const THIRD_PERSON = 1.5;
const MAX_DISTANCE = 22;
const MIN_PITCH = -1.2;
const MAX_PITCH = 1.35;
const MARGIN = 0.25;
const EASE_OUT_RATE = 4;
const FIRST_PERSON_SHOWN = 0.5;

// A distance of 0 is first person.
export class CameraRig
{
    constructor(camera)
    {
        this.camera = camera;
        this.yaw = 0;
        this.pitch = 0.2;
        this.distance = 0;
        this.shown = 0;
        this.eyes = new THREE.Vector3();
    }

    get isFirstPerson()
    {
        return this.shown < FIRST_PERSON_SHOWN;
    }

    orbit(deltaYaw, deltaPitch)
    {
        this.yaw += deltaYaw;
        this.pitch = Math.min(MAX_PITCH, Math.max(MIN_PITCH, this.pitch + deltaPitch));
    }

    zoom(factor)
    {
        if(this.distance === 0)
        {
            if(factor > 1) { this.distance = THIRD_PERSON; }

            return;
        }

        const distance = this.distance * factor;

        this.distance = distance < THIRD_PERSON ? 0 : Math.min(MAX_DISTANCE, distance);
    }

    setDistance(distance)
    {
        this.distance = distance < THIRD_PERSON ? 0 : Math.min(MAX_DISTANCE, distance);
    }

    groundForward()
    {
        return new THREE.Vector2(-Math.sin(this.yaw), -Math.cos(this.yaw));
    }

    // `raycast(origin, direction, distance)` returns how far the ray travels
    // before it meets a solid cell, up to `distance`.
    update(delta, target, eyeHeight, raycast)
    {
        const back = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));

        this.eyes.copy(target).setY(target.y + eyeHeight);

        const open = this.distance === 0 ? 0 : Math.max(0, raycast(this.eyes, back, this.distance + MARGIN) - MARGIN);

        this.shown = open < this.shown ? open : this.shown + (open - this.shown) * Math.min(1, delta * EASE_OUT_RATE);

        const position = this.eyes.clone().addScaledVector(back, this.shown);

        this.camera.position.copy(position);
        this.camera.lookAt(position.clone().sub(back));

        // The HUD projects nameplates through the camera before the frame
        // renders, which is when Three.js would update these matrices.
        this.camera.updateMatrixWorld();
    }
}
