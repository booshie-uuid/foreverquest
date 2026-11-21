import * as THREE from "three";

const MIN_DISTANCE = 2.5;
const MAX_DISTANCE = 22;
const MIN_PITCH = 0.08;
const MAX_PITCH = 1.35;

export class CameraRig
{
    constructor(camera)
    {
        this.camera = camera;
        this.yaw = 0;
        this.pitch = 0.42;
        this.distance = 9;
        this.focus = new THREE.Vector3();
        this.hasFocus = false;
    }

    orbit(deltaYaw, deltaPitch)
    {
        this.yaw += deltaYaw;
        this.pitch = Math.min(MAX_PITCH, Math.max(MIN_PITCH, this.pitch + deltaPitch));
    }

    zoom(factor)
    {
        this.distance = Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, this.distance * factor));
    }

    groundForward()
    {
        return new THREE.Vector2(-Math.sin(this.yaw), -Math.cos(this.yaw));
    }

    update(delta, target, focusHeight, heightAt)
    {
        const goal = target.clone().add(new THREE.Vector3(0, focusHeight, 0));

        if(this.hasFocus)
        {
            this.focus.lerp(goal, Math.min(1, delta * 8));
        }
        else
        {
            this.focus.copy(goal);
            this.hasFocus = true;
        }

        const horizontal = Math.cos(this.pitch) * this.distance;
        const position = new THREE.Vector3(
            this.focus.x + Math.sin(this.yaw) * horizontal,
            this.focus.y + Math.sin(this.pitch) * this.distance,
            this.focus.z + Math.cos(this.yaw) * horizontal,
        );
        const ground = heightAt(position.x, position.z) + 0.6;

        if(position.y < ground) { position.y = ground; }

        this.camera.position.copy(position);
        this.camera.lookAt(this.focus);
    }
}
