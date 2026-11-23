import * as THREE from "three";
import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CameraRig } from "../../js/game/camera-rig.js";

const FRAME = 1 / 60;

function rig()
{
    const camera = new THREE.PerspectiveCamera(55, 1.6, 0.1, 500);
    const built = new CameraRig(camera);

    camera.updateMatrixWorld();

    return built;
}

describe("Camera rig", () =>
{
    it("points the camera at its focus before the frame renders, so labels project where they belong", () =>
    {
        const camera = rig();
        const target = new THREE.Vector3(30, 2, -12);

        camera.update(FRAME, target, 1.4, () => 0);

        const centre = target.clone().add(new THREE.Vector3(0, 1.4, 0)).project(camera.camera);

        assert.ok(Math.hypot(centre.x, centre.y) < 1e-6, "The focus projects to " + centre.x + ", " + centre.y);
    });

    it("rises over a roof gradually rather than jumping", () =>
    {
        const camera = rig();
        const target = new THREE.Vector3(0, 0, 0);
        let roof = 0;

        for(let i = 0; i < 60; i++) { camera.update(FRAME, target, 1.4, () => roof); }

        const before = camera.camera.position.y;

        roof = before + 3;
        camera.update(FRAME, target, 1.4, () => roof);

        const after = camera.camera.position.y;

        assert.ok(after - before > 0 && after - before < 1, "The camera moved " + (after - before) + " in one frame");

        for(let i = 0; i < 120; i++) { camera.update(FRAME, target, 1.4, () => roof); }

        assert.ok(camera.camera.position.y >= roof + 0.6 - 0.01, "The camera stayed below the roof at " + camera.camera.position.y);
    });
});
