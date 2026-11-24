import * as Buildings from "../../content/props/buildings.js";
import * as Kit from "../../content/art/kit.js";
import * as PropBaker from "../../tools/bake/props.js";
import * as TestAssets from "../helpers/assets.js";
import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Appearance } from "../../js/character/appearance.js";
import { Entity } from "../../js/sim/entity.js";
import { ZoneData } from "../../js/sim/zone-data.js";

const BASE = { width: 16, depth: 20, storeys: 3, walls: { ground: "stone", upper: "plaster" }, roof: { texture: "slate" }, doors: [{ at: 0 }] };

function problemsOf(changes)
{
    return PropBaker.record(Kit.building({ ...BASE, ...changes })).problems;
}

describe("Building kit", () =>
{
    it("reports an upper storey with no stair, lift or locked stair door below it", () =>
    {
        assert.deepEqual(problemsOf({}), ["has no stair, lift or locked stair door to storey 1", "has no stair, lift or locked stair door to storey 2"]);
        assert.deepEqual(problemsOf({ stairs: [{ side: "left", storey: 0, from: -6 }] }), ["has no stair, lift or locked stair door to storey 2"]);
        assert.deepEqual(problemsOf({ stairs: [{ side: "left", storey: 0, from: -6 }], lifts: [{ storey: 2 }] }), []);
        assert.deepEqual(problemsOf({ lockedStairs: [{ side: "back", storey: 0 }] }), []);
    });

    it("reports a stair with no room to walk onto it or step off it, and a footprint with an odd side", () =>
    {
        assert.match(problemsOf({ storeys: 2, stairs: [{ side: "left", storey: 0, from: -7 }] })[0], /less than 3 cubes to walk onto it along its left wall/);
        assert.match(problemsOf({ storeys: 2, stairs: [{ side: "left", storey: 0, from: 0 }] })[0], /no floor to step off onto along its left wall/);
        assert.match(problemsOf({ width: 15, storeys: 1 })[0], /even sides/);
    });

    it("records a front doorway 7 cubes tall, a clearing for the footprint, a locked door and a lamp a storey", () =>
    {
        const recorded = PropBaker.record(Kit.building({ ...BASE, lockedStairs: [{ side: "back", storey: 0, at: 2 }] }));
        const [door] = recorded.doors;

        assert.equal(Math.round(door.size[1] * 3), 7);
        assert.equal(Math.round((door.at[1] - door.size[1] / 2) * 3), 0);
        assert.deepEqual(recorded.clears[0].size.map((metres) => Math.round(metres * 3)), [16, 30, 20]);
        assert.deepEqual(recorded.objects.map((entry) => entry.object), ["lockedDoor", ...Array(12).fill("lantern")]);
        assert.ok(recorded.objects.filter((entry) => entry.object === "lantern").every((entry) => Math.round(entry.at[1] * 3) % 10 === 7), "A lantern hangs lower than 7 cubes");
    });

    it("hangs every lantern of the grid, moving one that falls over a stair to the nearest clear spot", () =>
    {
        const lanterns = (spec) => PropBaker.record(Kit.building(spec)).objects.filter((entry) => entry.object === "lantern");
        const house = Buildings.BUILDINGS.house;
        const ground = lanterns(house).filter((entry) => entry.at[1] < 10 / 3);

        assert.equal(ground.length, 4, "The house's ground floor lost a lantern to its stair");
        assert.equal(new Set(ground.map((entry) => entry.at.join(","))).size, 4);
    });

    it("lets an entity walk up every stair of every kit building in Hearthmere and the Expanse", async () =>
    {
        const library = await TestAssets.library();
        let flights = 0;

        for(const id of ["hearthmere", "expanse"])
        {
            const zone = await TestAssets.zone(id);

            for(const building of zone.objects.filter((entry) => Buildings.BUILDINGS[entry.name]?.stairs))
            {
                const spec = Buildings.BUILDINGS[building.name];

                for(const flight of spec.stairs)
                {
                    const isAcross = flight.side === "front" || flight.side === "back";
                    const half = (isAcross ? spec.depth : spec.width) / 2;
                    const lane = { left: -half + 3, right: half - 3, back: -half + 3, front: half - 3 }[flight.side];
                    const local = (along) => (isAcross ? [along / 3, 0, lane / 3] : [lane / 3, 0, along / 3]);
                    const placement = { x: building.x, y: 0, z: building.z, angle: (building.turns * Math.PI) / 2, scale: 1 };
                    const [x, , z] = ZoneData.toWorld(local(flight.from - 1.5), placement);
                    const [ahead, , beyond] = ZoneData.toWorld(local(flight.from + 20), placement);
                    const actor = new Entity(1, new Appearance(library));
                    const floor = zone.metresY(building.box[1] + 6) + (flight.storey * 10) / 3;

                    actor.position = { x, y: floor, z };
                    actor.steer(ahead - x, beyond - z);

                    for(let time = 0; time < 6 && actor.position.y < floor + 10 / 3 - 0.01; time += 0.05) { actor.tick(0.05, zone); }

                    assert.ok(Math.abs(actor.position.y - floor - 10 / 3) < 0.01, id + " " + building.name + " stair from storey " + flight.storey + " stopped at " + (actor.position.y - floor).toFixed(2) + " m");
                    flights++;
                }
            }
        }

        assert.ok(flights >= 8, flights + " flights");
    });
});
