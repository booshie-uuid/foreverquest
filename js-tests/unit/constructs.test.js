import * as Blocks from "../../tools/bake/blocks.js";
import * as Constructs from "../../tools/bake/constructs.js";
import * as FineMesher from "../../js/render/fine-mesher.js";
import * as Models from "../../tools/bake/models.js";
import * as TestAssets from "../helpers/assets.js";
import * as WorldTextures from "../../tools/bake/world-textures.js";
import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Appearance } from "../../js/character/appearance.js";
import { ConstructLook } from "../../js/character/construct-look.js";
import { ConstructModel } from "../../js/render/construct-model.js";
import { Simulation } from "../../js/sim/simulation.js";

const context = {};

for(const baker of [WorldTextures, Blocks, Models]) { await baker.bake([], context); }

const known = { blocks: new Map(context.blocks.map((block) => [block.id, block])), rigs: context.rigs, objects: { chest: {} } };
const library = await TestAssets.library();

// A piece of `size` fine cubes, all of one block.
function solid(size, block = "stone")
{
    return { size, palette: [null, block], runs: [1, size[0] * size[1] * size[2]] };
}

function humanoid(pieces, extra = {})
{
    return { name: "test", rig: "humanoid", measures: { radius: 0.4, walk: 1, run: 2, nameplate: 0.3, focus: 1.5 }, pieces, ...extra };
}

async function enterTestField()
{
    const sim = new Simulation(library, await TestAssets.people());
    const zone = await TestAssets.zone("testfield");

    sim.setPlayer(new Appearance(library, { name: "Tester" }));
    sim.enter(zone);

    return { sim, zone };
}

function run(sim, seconds)
{
    for(let t = 0; t < seconds; t += Simulation.TICK) { sim.tick(); }
}

function eventsOf(sim)
{
    const events = [];

    sim.onEvent((event) => events.push(event.type));

    return events;
}

describe("Construct bake", () =>
{
    it("sizes the rig's boxes from the pieces, mirrors a twin's piece across x, and finds the cubes it stands in", () =>
    {
        const arm = { size: [2, 3, 1], palette: [null, "stone", "rock"], runs: [1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 2, 1] };
        const problems = [];
        const baked = Constructs.bakeConstruct("tester", humanoid({ head: solid([8, 8, 8]), torso: solid([12, 16, 6]), armL: arm, legL: solid([6, 20, 6]) }), known, "Test", problems);
        const grid = FineMesher.decode(baked.pieces.armR);

        assert.deepEqual(problems, []);
        assert.deepEqual(baked.body.boxes, { head: [16, 16, 16], torso: [24, 32, 12], arm: [4, 6, 2], leg: [12, 40, 12] });
        assert.deepEqual([...grid.data.slice(0, 2)].map((index) => grid.palette[index]), ["rock", "stone"], "armR is not armL mirrored");
        assert.deepEqual(baked.footprint, [2, 6, 1]);
    });

    it("refuses a missing piece, twins of two sizes, a piece for a bone without a box, an unknown block, an object's id and a bad dormant pose", () =>
    {
        const problems = [];
        const pieces = { head: solid([8, 8, 8], "nothingLikeThis"), torso: solid([12, 16, 6]), armL: solid([4, 16, 4]), armR: solid([4, 14, 4]), cape: solid([2, 2, 2]) };

        Constructs.bakeConstruct("chest", humanoid(pieces, { dormant: { tail: [0, 0, 0] } }), known, "Test", problems);

        for(const expected of [/object/, /unknown block/, /does not box: cape/, /no piece for its bone legL/, /dormant pose/]) { assert.ok(problems.some((problem) => expected.test(problem)), "No problem matches " + expected + ": " + problems.join("; ")); }

        const boxed = { ...pieces };

        delete boxed.cape;

        problems.length = 0;
        Constructs.bakeConstruct("tester", humanoid({ ...boxed, head: solid([8, 8, 8]), legL: solid([6, 20, 6]) }), known, "Test", problems);

        assert.ok(problems.some((problem) => /pieces of different sizes/.test(problem)), problems.join("; "));
    });
});

describe("Construct model", () =>
{
    it("hangs a piece on each boxed bone and the extras on theirs, stands as tall as its fit, and leans into its dormant pose until woken", async () =>
    {
        const materials = await TestAssets.materials();
        const blocks = await TestAssets.blocks();
        const cell = {};
        const gargoyle = new ConstructModel(new ConstructLook(library, "gargoyle"), materials, blocks, cell);
        const golem = new ConstructModel(new ConstructLook(library, "golem"), materials, blocks, cell);
        const dormant = gargoyle.joints.armL.rotation.x;

        gargoyle.pose(0);

        assert.deepEqual(gargoyle.meshes.map((mesh) => mesh.parent.name), ["head", "torso", "armL", "armR", "legL", "legR", "cape", "cape"]);
        assert.ok(Math.abs(golem.plan.height - golem.plan.fit.top * 2 / 48) < 1e-9 && golem.plan.height > 2.5, "The golem is " + golem.plan.height + " m tall");
        assert.deepEqual([dormant, gargoyle.joints.armL.rotation.x], [-0.55, 0]);
        assert.ok(gargoyle.triangleCount > 0);
        gargoyle.dispose();
        golem.dispose();
    });
});

describe("Constructs", () =>
{
    it("sleep until the player comes near, then wake, pursue, shove the player back, and past the leash walk home and stand guard", async () =>
    {
        const { sim, zone } = await enterTestField();
        const events = eventsOf(sim);
        const armour = sim.constructs.find((entity) => entity.construct.id === "armour");
        const home = { ...armour.position };

        sim.player.placeAt(home.x, home.z + 6, zone);
        run(sim, 1);

        const asleep = armour.brain.state;

        sim.player.placeAt(home.x, home.z + 2.5, zone);
        run(sim, 0.2);

        const woken = armour.brain.state;

        run(sim, 4);

        const shovedAt = events.indexOf("shoved");

        sim.player.placeAt(home.x, home.z + 14, zone);
        run(sim, 12);

        const guarding = { state: armour.brain.state, distance: Math.hypot(armour.position.x - home.x, armour.position.z - home.z) };

        sim.player.placeAt(home.x, home.z + 2.5, zone);
        run(sim, 0.2);

        assert.deepEqual([asleep, woken], ["dormant", "waking"]);
        assert.ok(events.indexOf("woke") >= 0 && shovedAt > events.indexOf("woke"), "The armour never shoved the player: " + events.join(", "));
        assert.equal(guarding.state, "guarding");
        assert.ok(guarding.distance < 0.5, "The armour stands " + guarding.distance + " m from its spot");
        assert.equal(armour.brain.state, "pursuing", "The guard did not pursue the player in sight");
        sim.movers.dispose();
    });

    it("wake by a linked plate alone, and keep the player out of a sleeping construct", async () =>
    {
        const { sim, zone } = await enterTestField();
        const golem = sim.constructs.find((entity) => entity.construct.id === "golem");
        const plate = zone.objects.find((entry) => entry.trigger?.plate);

        sim.player.placeAt(golem.position.x + 2.5, golem.position.z, zone);
        sim.player.steer(-1, 0);
        run(sim, 2);

        const gap = Math.hypot(sim.player.position.x - golem.position.x, sim.player.position.z - golem.position.z);
        const asleep = golem.brain.state;

        sim.player.stop();
        sim.player.placeAt(plate.x, plate.z, zone);
        run(sim, 0.2);

        assert.ok(gap >= sim.player.radius + golem.radius - 1e-6, "The player walked into the golem: " + gap);
        assert.deepEqual([asleep, golem.brain.state], ["dormant", "waking"]);
        sim.movers.dispose();
    });

    it("are not villagers: a talk command to one does nothing, and the zone's villagers do not count them", async () =>
    {
        const { sim } = await enterTestField();
        const armour = sim.constructs[0];

        sim.command({ type: "talk", id: armour.id });
        sim.tick();

        assert.equal(sim.talkTarget, null);
        assert.equal(sim.npcs.some((entity) => entity.construct), false);
        assert.equal(sim.constructs.length, 4);
        sim.movers.dispose();
    });
});
