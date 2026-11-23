import * as THREE from "three";
import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CameraRig } from "../../js/game/camera-rig.js";

const FRAME = 1 / 60;
const EYES = 1.7;
const OPEN = (origin, direction, distance) => distance;

function rig()
{
    const camera = new THREE.PerspectiveCamera(55, 1.6, 0.1, 500);

    camera.updateMatrixWorld();

    return new CameraRig(camera);
}

function run(built, frames, raycast)
{
    for(let i = 0; i < frames; i++) { built.update(FRAME, new THREE.Vector3(4, 1, -2), EYES, raycast); }
}

describe("Camera rig", () =>
{
    it("starts in first person at the player's eyes", () =>
    {
        const built = rig();

        run(built, 1, OPEN);

        assert.ok(built.isFirstPerson);
        assert.ok(built.camera.position.distanceTo(new THREE.Vector3(4, 1 + EYES, -2)) < 1e-9);
    });

    it("zooms out of first person to third person, and back in past its nearest distance", () =>
    {
        const built = rig();

        built.zoom(1.1);
        assert.equal(built.distance, 1.5);

        built.zoom(1 / 1.1);
        assert.equal(built.distance, 0);
    });

    it("looks at the player's eyes before the frame renders, so labels project where they belong", () =>
    {
        const built = rig();

        built.setDistance(9);
        run(built, 240, OPEN);

        const centre = new THREE.Vector3(4, 1 + EYES, -2).project(built.camera);

        assert.equal(built.isFirstPerson, false);
        assert.ok(Math.hypot(centre.x, centre.y) < 1e-6, "The eyes project to " + centre.x + ", " + centre.y);
    });

    it("pulls in at once in front of a wall, and eases back out when it is gone", () =>
    {
        const built = rig();
        const wall = (origin, direction, distance) => Math.min(distance, 3);

        built.setDistance(9);
        run(built, 240, OPEN);
        run(built, 1, wall);

        assert.ok(built.shown <= 3 - 0.25 + 1e-9, "The camera stayed " + built.shown + " behind the eyes");

        run(built, 1, OPEN);

        assert.ok(built.shown < 4, "The camera jumped back out to " + built.shown);

        run(built, 240, OPEN);

        assert.ok(Math.abs(built.shown - 9) < 0.01);
    });
});
