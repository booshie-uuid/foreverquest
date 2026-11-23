import * as Pathfinder from "../../js/sim/pathfinder.js";
import * as RegionCodec from "../../js/sim/region-codec.js";
import * as TestAssets from "../helpers/assets.js";
import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Appearance } from "../../js/character/appearance.js";
import { Entity } from "../../js/sim/entity.js";
import { ZoneData } from "../../js/sim/zone-data.js";

const blocks = await TestAssets.blocks();
const library = await TestAssets.library();
const STONE = blocks.number("stone");
const WATER = blocks.number("water");
const BASE = 4;
const RADIUS = 0.35;

// A 32 by 32 cell zone with its ground's top at cell 4, height 0 metres.
// `build(set)` adds cells; x and z run from 0 to 31.
function cellZone(build)
{
    const cells = new Uint8Array(RegionCodec.CELLS);
    const surfaces = new Uint16Array(32 * 32);
    const grounds = new Uint16Array(32 * 32).fill(BASE);
    const set = (x, y, z, block = STONE) => { cells[(y * 32 + z) * 32 + x] = block; };

    for(let z = 0; z < 32; z++) { for(let x = 0; x < 32; x++) { for(let y = 0; y < BASE; y++) { set(x, y, z); } } }

    build(set);

    for(let z = 0; z < 32; z++)
    {
        for(let x = 0; x < 32; x++)
        {
            let top = 0;

            for(let y = 0; y < 32; y++) { if(blocks.isSolid(cells[(y * 32 + z) * 32 + x])) { top = y + 1; } }

            surfaces[z * 32 + x] = top;
        }
    }

    const index = { id: "cells", name: "cells", columns: 32, height: 32, base: BASE, water: 0, lighting: {}, spawn: { x: 0, z: 0 }, people: { seed: 1, residents: [] }, lights: [], regions: ["0-0"] };

    return new ZoneData(index, [{ name: "0-0", width: 32, depth: 32, height: 32, surfaces, grounds, chunks: [{ x: 0, y: 0, z: 0, uniform: null, cells }] }], blocks);
}

function metres(cell)
{
    return (cell + 0.5) / 3 - 16 / 3;
}

function walker(zone, x, z)
{
    const actor = new Entity(1, new Appearance(library));

    actor.placeAt(x, z, zone);

    return actor;
}

function run(actor, zone, seconds)
{
    for(let time = 0; time < seconds; time += 0.05) { actor.tick(0.05, zone); }
}

describe("Movement on cells", () =>
{
    it("steps up one cube, and stops at a rise of two", () =>
    {
        const zone = cellZone((set) =>
        {
            for(let z = 0; z < 32; z++) { for(let x = 18; x < 32; x++) { set(x, 4, z); } }
            for(let z = 0; z < 32; z++) { for(let x = 22; x < 32; x++) { set(x, 5, z); set(x, 6, z); } }
        });
        const actor = walker(zone, metres(12), 0);

        actor.steer(1, 0);
        run(actor, zone, 3);

        assert.equal(actor.position.y, 1 / 3);
        assert.ok(actor.position.x < 22 / 3 - 16 / 3 && actor.position.x > 21 / 3 - 16 / 3 - RADIUS, "x is " + actor.position.x);
    });

    it("walks under a ceiling six cubes up, but not under one five cubes up", () =>
    {
        const zone = cellZone((set) =>
        {
            for(let x = 18; x < 22; x++) { for(let z = 0; z < 16; z++) { set(x, BASE + 5, z); } }
            for(let x = 18; x < 22; x++) { for(let z = 16; z < 32; z++) { set(x, BASE + 6, z); } }
        });
        const low = walker(zone, metres(12), metres(8));
        const high = walker(zone, metres(12), metres(24));

        for(const actor of [low, high])
        {
            actor.steer(1, 0);
            run(actor, zone, 3);
        }

        assert.ok(low.position.x < 18 / 3 - 16 / 3, "The low ceiling let the entity through to " + low.position.x);
        assert.ok(high.position.x > 22 / 3 - 16 / 3, "The high ceiling stopped the entity at " + high.position.x);
    });

    it("falls under gravity from a ledge to the ground", () =>
    {
        const zone = cellZone(() => {});
        const actor = walker(zone, 0, 0);

        actor.position = { x: 0, y: 2, z: 0 };
        actor.tick(0.05, zone);

        assert.ok(actor.position.y > 1.9, "The entity dropped too fast, to " + actor.position.y);

        run(actor, zone, 1);

        assert.equal(actor.position.y, 0);
    });

    it("lifts an entity buried in the ground onto it", () =>
    {
        const zone = cellZone(() => {});
        const actor = walker(zone, 0, 0);

        actor.position = { x: 0, y: -1, z: 0 };
        actor.tick(0.05, zone);

        assert.equal(actor.position.y, 0);
    });

    it("slides along a wall it walks into at an angle", () =>
    {
        const zone = cellZone((set) =>
        {
            for(let z = 0; z < 32; z++) { for(let y = BASE; y < BASE + 3; y++) { set(20, y, z); } }
        });
        const actor = walker(zone, metres(15), metres(8));

        actor.steer(1, 1);
        run(actor, zone, 2);

        assert.ok(actor.position.z > metres(8) + 1, "The entity stuck at the wall instead of sliding, at z " + actor.position.z);
    });

    it("refuses a step into water", () =>
    {
        const zone = cellZone((set) =>
        {
            for(let z = 0; z < 32; z++) { for(let x = 20; x < 32; x++) { set(x, BASE - 1, z, WATER); } }
        });

        assert.equal(zone.footingAt(metres(24), 0, 0, RADIUS), null);
        assert.ok(zone.footingAt(metres(14), 0, 0, RADIUS));
    });
});

describe("Pathfinder", () =>
{
    const wallWithGap = (set) =>
    {
        for(let z = 0; z < 32; z++)
        {
            if(z >= 22 && z < 26) { continue; }

            for(let y = BASE; y < BASE + 3; y++) { set(16, y, z); }
        }
    };

    it("finds a way through the gap in a wall, and every point on it can be stood on", () =>
    {
        const zone = cellZone(wallWithGap);
        const from = { x: metres(10), y: 0, z: metres(8) };
        const to = { x: metres(22), z: metres(8) };
        const path = Pathfinder.find(zone, from, to, RADIUS);

        assert.ok(path && path.length >= 2, JSON.stringify(path));
        assert.deepEqual(path.at(-1), to);
        assert.ok(path.some((point) => point.z > metres(20)), "The path did not go through the gap: " + JSON.stringify(path));
        assert.ok(path.every((point) => zone.footingAt(point.x, point.z, 0, RADIUS)), JSON.stringify(path));
    });

    it("leads an entity through the gap to the far side", () =>
    {
        const zone = cellZone(wallWithGap);
        const actor = walker(zone, metres(10), metres(8));

        actor.follow(Pathfinder.find(zone, actor.position, { x: metres(22), z: metres(8) }, RADIUS));
        run(actor, zone, 12);

        assert.ok(Math.hypot(actor.position.x - metres(22), actor.position.z - metres(8)) < 0.2, JSON.stringify(actor.position));
    });

    it("walks as near as it can to a place it cannot reach", () =>
    {
        const zone = cellZone((set) =>
        {
            for(let x = 18; x < 26; x++)
            {
                for(let z = 8; z < 16; z++)
                {
                    const isEdge = x === 18 || x === 25 || z === 8 || z === 15;

                    if(isEdge) { for(let y = BASE; y < BASE + 3; y++) { set(x, y, z); } }
                }
            }
        });
        const path = Pathfinder.find(zone, { x: metres(10), y: 0, z: metres(11) }, { x: metres(21), z: metres(11) }, RADIUS);

        const end = path?.at(-1);
        const isInside = end && end.x > 18 / 3 - 16 / 3 && end.x < 26 / 3 - 16 / 3 && end.z > 8 / 3 - 16 / 3 && end.z < 16 / 3 - 16 / 3;

        assert.ok(end && !isInside && Math.hypot(end.x - metres(21), end.z - metres(11)) < 2, JSON.stringify(end));
    });
});
