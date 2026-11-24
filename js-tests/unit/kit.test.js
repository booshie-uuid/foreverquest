import * as Kit from "../../content/art/kit.js";
import * as PropBaker from "../../tools/bake/props.js";
import * as assert from "node:assert/strict";
import { describe, it } from "node:test";

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
        assert.deepEqual(problemsOf({ stairs: [{ side: "left", storey: 0, from: -8 }] }), ["has no stair, lift or locked stair door to storey 2"]);
        assert.deepEqual(problemsOf({ stairs: [{ side: "left", storey: 0, from: -8 }], lifts: [{ storey: 2 }] }), []);
        assert.deepEqual(problemsOf({ lockedStairs: [{ side: "back", storey: 0 }] }), []);
    });

    it("reports a stair that does not fit along its wall, and a footprint with an odd side", () =>
    {
        assert.match(problemsOf({ storeys: 2, stairs: [{ side: "left", storey: 0, from: 2 }] })[0], /does not fit along its left wall/);
        assert.match(problemsOf({ width: 15, storeys: 1 })[0], /even sides/);
    });

    it("records a front doorway 7 cubes tall, a clearing for the footprint, a locked door and a lamp a storey", () =>
    {
        const recorded = PropBaker.record(Kit.building({ ...BASE, lockedStairs: [{ side: "back", storey: 0, at: 2 }] }));
        const [door] = recorded.doors;

        assert.equal(Math.round(door.size[1] * 3), 7);
        assert.equal(Math.round((door.at[1] - door.size[1] / 2) * 3), 0);
        assert.deepEqual(recorded.clears[0].size.map((metres) => Math.round(metres * 3)), [16, 30, 20]);
        assert.deepEqual(recorded.objects.map((entry) => entry.object), ["lockedDoor", ...Array(3).fill("lantern")]);
        assert.ok(recorded.objects.filter((entry) => entry.object === "lantern").every((entry) => Math.round(entry.at[1] * 3) % 10 === 7), "A lantern hangs lower than 7 cubes");
    });
});
