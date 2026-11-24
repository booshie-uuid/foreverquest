import * as THREE from "three";
import * as TestAssets from "../helpers/assets.js";
import * as Voxelise from "../../tools/bake/voxelise.js";
import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Appearance } from "../../js/character/appearance.js";
import { Movers } from "../../js/sim/movers.js";
import { Simulation } from "../../js/sim/simulation.js";

const TICK = 1 / 20;

// A stand-in for an entity: all a mover reads and writes.
function body(zone, [x, y, z])
{
    return { position: { x: (x + 0.5) / 3 - zone.columns / 6, y: zone.metresY(y), z: (z + 0.5) / 3 - zone.columns / 6 }, radius: 0.3, riding: null };
}

function run(movers, seconds, entities = [])
{
    for(let t = 0; t < seconds; t += TICK) { movers.tick(TICK, entities); }
}

describe("Movers", () =>
{
    it("claims a mover's cells, and on arrival frees those it left", async () =>
    {
        const zone = await TestAssets.zone("testfield");
        const movers = new Movers(zone);
        const gate = movers.mover("gate");
        const [low] = gate.entry.cells;
        const high = gate.entry.cellsMoved.at(-1);

        assert.ok(zone.isSolid(...low), "The closed gate does not block");
        gate.setTarget(1);
        run(movers, 3);

        assert.equal(gate.progress, 1);
        assert.ok(!zone.isSolid(...low), "The raised gate still blocks the opening");
        assert.ok(zone.isSolid(...high));
        movers.dispose();
    });

    it("waits while an entity stands in its path, and moves once the path is clear", async () =>
    {
        const zone = await TestAssets.zone("testfield");
        const movers = new Movers(zone);
        const lift = movers.mover("lift");
        const below = body(zone, lift.entry.cells[4]);

        lift.setTarget(1);
        run(movers, 5);
        lift.setTarget(0);
        run(movers, 2, [below]);

        assert.equal(lift.progress, 1, "The lift came down onto the entity under it");

        run(movers, 5);

        assert.equal(lift.progress, 0);
        movers.dispose();
    });

    it("carries an entity standing on a lift up to the landing", async () =>
    {
        const zone = await TestAssets.zone("testfield");
        const movers = new Movers(zone);
        const lift = movers.mover("lift");
        const [x, y, z] = lift.entry.cells[4];
        const rider = body(zone, [x, y + 1, z]);

        lift.setTarget(1);
        movers.tick(TICK, [rider]);

        assert.equal(rider.riding, lift);

        run(movers, 5, [rider]);

        assert.equal(rider.riding, null);
        assert.ok(Math.abs(rider.position.y - zone.metresY(lift.entry.cellsMoved[4][1] + 1)) < 1e-6, "The rider is not on the raised lift");
        movers.dispose();
    });

    it("toggles a lever's movers each time it is used", async () =>
    {
        const zone = await TestAssets.zone("testfield");
        const movers = new Movers(zone);
        const lever = zone.objects.find((entry) => entry.object === "leverBase");
        const well = zone.objects.find((entry) => entry.name === "well");

        assert.ok(movers.use(lever.prop));
        assert.deepEqual(["gate", "gateLever"].map((id) => movers.mover(id).target), [1, 1]);
        assert.ok(movers.use(lever.prop));
        assert.deepEqual(["gate", "gateLever"].map((id) => movers.mover(id).target), [0, 0]);
        assert.equal(movers.use(well.prop), false);
        movers.dispose();
    });

    it("sends its movers to their far end while an entity stands on a plate, or comes near", async () =>
    {
        const zone = await TestAssets.zone("testfield");
        const gate = zone.objects.find((entry) => entry.id === "gate");
        const plate = { prop: 900, object: "plate", box: [10, 18, 10, 11, 18, 11], trigger: { plate: true, movers: ["gate"] } };
        const near = { ...gate, prop: 901, id: "nearGate", mover: { ...gate.mover, near: 2 } };

        zone.objects.push(plate, near);

        const movers = new Movers(zone);
        const onPlate = body(zone, [10, 18, 10]);
        const byGate = { ...body(zone, [0, 18, 0]), position: { x: near.x + 1, y: near.y, z: near.z + 1 } };

        movers.tick(TICK, [onPlate, byGate]);

        assert.deepEqual([movers.mover("gate").target, movers.mover("nearGate").target], [1, 1]);

        movers.tick(TICK, []);

        assert.deepEqual([movers.mover("gate").target, movers.mover("nearGate").target], [0, 0]);
        movers.dispose();
        zone.objects.splice(-2);
    });

    it("walks the player around the fence to a lever, which raises the gate", async () =>
    {
        const library = await TestAssets.library();
        const sim = new Simulation(library, await TestAssets.people());
        const zone = await TestAssets.zone("testfield");
        const lever = zone.objects.find((entry) => entry.object === "leverBase");

        sim.setPlayer(new Appearance(library, { name: "Tester" }));
        sim.enter(zone);
        sim.player.placeAt(-6, 8.5, zone);
        sim.command({ type: "use", prop: lever.prop });

        for(let i = 0; i < 200; i++) { sim.tick(); }

        assert.equal(sim.movers.mover("gate").target, 1, "The player never pulled the lever");
        sim.movers.dispose();
    });

    it("turns a cell about its pivot as the view turns the mesh", () =>
    {
        for(const [axis, vector] of [["x", [1, 0, 0]], ["y", [0, 1, 0]], ["z", [0, 0, 1]]])
        {
            const local = [2, 1, 0];
            const pivot = [4, 4, 4];
            const turned = Voxelise.rotateCell(local, axis, pivot, Math.PI / 2);
            const centre = new THREE.Vector3(...local.map((value, i) => (value + 0.5) * 8 - pivot[i]))
                .applyAxisAngle(new THREE.Vector3(...vector), Math.PI / 2)
                .add(new THREE.Vector3(...pivot))
                .divideScalar(8);

            assert.deepEqual(turned, centre.toArray().map(Math.floor), axis);
        }
    });
});
