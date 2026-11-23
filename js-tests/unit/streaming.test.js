import * as TestAssets from "../helpers/assets.js";
import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Appearance } from "../../js/character/appearance.js";
import { BlockSet } from "../../js/sim/block-set.js";
import { RegionStreamer } from "../../js/engine/region-streamer.js";
import { Simulation } from "../../js/sim/simulation.js";
import { ZoneView } from "../../js/render/zone-view.js";

const source = await TestAssets.open();
const blocks = await BlockSet.load(source);
const materials = await TestAssets.materials();
const FAR = { x: 400, z: 380 };

describe("Region streaming", () =>
{
    it("loads only the regions near the spawn point of a large zone", async () =>
    {
        const streamer = await RegionStreamer.open(source, "expanse", blocks);
        const zone = streamer.zone;
        const spawnRegion = zone.regionOfColumn(...zone.columnOf(zone.spawn.x, zone.spawn.z));

        assert.equal(zone.regionNames.length, 144);
        assert.ok(zone.regions.size > 4 && zone.regions.size < 40, zone.regions.size + " regions loaded");
        assert.ok(zone.hasRegion(spawnRegion));
        assert.ok(zone.heightAt(0, 0) > 0);
        assert.equal(zone.isLoaded(FAR.x, FAR.z), false);
    });

    it("loads the regions ahead of a moving point and frees those left behind", async () =>
    {
        const streamer = await RegionStreamer.open(source, "expanse", blocks);
        const zone = streamer.zone;
        const view = new ZoneView(zone, materials);
        const spawnRegion = zone.regionOfColumn(...zone.columnOf(0, 0));
        const meshesNearSpawn = view.terrainMeshes.length;

        await streamer.settle(FAR.x, FAR.z);

        assert.ok(zone.isLoaded(FAR.x, FAR.z));
        assert.equal(zone.hasRegion(spawnRegion), false);
        assert.equal(zone.surface(...zone.columnOf(0, 0)), 0);

        view.update(0.016, { position: view.sky.position.clone() }, { x: FAR.x, y: 0, z: FAR.z });

        assert.ok(meshesNearSpawn > 0 && view.terrainMeshes.length > 0);

        const keys = new Set(zone.chunks.keys());

        assert.ok([...view.chunkArrays.keys()].every((key) => keys.has(key)), "A mesh outlived its region");
        view.dispose();
    });

    it("leaves an entity asleep while the region under it is not loaded, and stops a step into it", async () =>
    {
        const library = await TestAssets.library();
        const streamer = await RegionStreamer.open(source, "expanse", blocks);
        const zone = streamer.zone;
        const sim = new Simulation(library, { npcs: {}, lines: {} });

        sim.setPlayer(new Appearance(library, { name: "Tester" }));
        sim.enter(zone);
        sim.player.placeAt(FAR.x, FAR.z, zone);
        sim.command({ type: "steer", x: 1, z: 0 });

        for(let i = 0; i < 10; i++) { sim.tick(); }

        assert.deepEqual([sim.player.position.x, sim.player.position.z], [FAR.x, FAR.z]);
        assert.equal(zone.isWalkable(FAR.x, FAR.z), false);
    });
});
