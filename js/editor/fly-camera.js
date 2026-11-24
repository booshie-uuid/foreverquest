import * as THREE from "three";

const SPEED = 8;
const FAST = 4;
const MIN_PITCH = -1.5;
const MAX_PITCH = 1.5;
const LOOK = { yaw: 0.006, pitch: 0.005 };

// Yaw 0 looks along -z, and a positive pitch looks down.
export class FlyCamera
{
    constructor(camera)
    {
        this.camera = camera;
        this.position = new THREE.Vector3();
        this.yaw = 0;
        this.pitch = 0;
    }

    get view()
    {
        return { x: this.position.x, y: this.position.y, z: this.position.z, yaw: this.yaw, pitch: this.pitch };
    }

    setView({ x, y, z, yaw, pitch })
    {
        this.position.set(x, y, z);
        this.yaw = yaw;
        this.pitch = pitch;
        this.apply();
    }

    takeOver()
    {
        const forward = new THREE.Vector3();

        this.camera.getWorldDirection(forward);
        this.position.copy(this.camera.position);
        this.yaw = Math.atan2(-forward.x, -forward.z);
        this.pitch = -Math.asin(Math.max(-1, Math.min(1, forward.y)));
        this.apply();
    }

    look(dx, dy)
    {
        this.yaw -= dx * LOOK.yaw;
        this.pitch = Math.max(MIN_PITCH, Math.min(MAX_PITCH, this.pitch + dy * LOOK.pitch));
    }

    // The ground direction the camera faces, snapped to the nearest of +x, -x,
    // +z and -z.
    facingAxis()
    {
        const x = -Math.sin(this.yaw);
        const z = -Math.cos(this.yaw);

        return Math.abs(x) > Math.abs(z) ? [Math.sign(x), 0] : [0, Math.sign(z)];
    }

    update(delta, input)
    {
        const speed = SPEED * (input.isDown("ShiftLeft", "ShiftRight") ? FAST : 1) * delta;
        const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
        const right = new THREE.Vector3(-forward.z, 0, forward.x);
        const move = new THREE.Vector3();
        const isShortcut = input.isDown("ControlLeft", "ControlRight");

        if(!isShortcut && input.isDown("KeyW")) { move.add(forward); }
        if(!isShortcut && input.isDown("KeyS")) { move.sub(forward); }
        if(!isShortcut && input.isDown("KeyD")) { move.add(right); }
        if(!isShortcut && input.isDown("KeyA")) { move.sub(right); }
        if(input.isDown("Space")) { move.y += 1; }
        if(!isShortcut && input.isDown("KeyC")) { move.y -= 1; }

        if(move.lengthSq() > 0) { this.position.addScaledVector(move.normalize(), speed); }

        this.apply();
    }

    apply()
    {
        this.camera.position.copy(this.position);
        this.camera.rotation.set(-this.pitch, this.yaw, 0, "YXZ");
        this.camera.updateMatrixWorld();
    }
}
