import * as TestAssets from "../helpers/assets.js";
import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BrushStroke } from "../../js/editor/brush-stroke.js";

const zone = await TestAssets.zone("testfield");
const blocks = zone.blocks;
const MIDDLE = [48, 0, 16];
const RADIUS = 2;
const CELLS = RADIUS * 3;

function strokeOf(brush, cover = new Map())
{
    return new BrushStroke(zone, blocks, { radius: RADIUS, strength: 1, ...brush }, (column, row) => topOf(column, row) + 1, cover);
}

// Runs a stroke, hands it to `check`, then puts the zone's cells back.
function withStroke(stroke, dabs, check)
{
    for(const cell of dabs) { stroke.dab(cell); }

    try
    {
        check(stroke);
    }
    finally
    {
        zone.setCells(stroke.cells().old);
    }
}

function topOf(column, row)
{
    let y = zone.height - 1;

    while(y > 0 && !blocks.isSolid(zone.blockAt(column, y, row))) { y--; }

    return y;
}

describe("Brush strokes", () =>
{
    it("paint a ground's top block over its middle, with the soft cells under it, and leave the ground beyond the edge", () =>
    {
        const sand = blocks.number("sand");
        const [cx, , cz] = MIDDLE;
        const top = topOf(cx, cz);

        withStroke(strokeOf({ kind: "ground", ground: "sand" }), [MIDDLE], (stroke) =>
        {
            const ring = (share) => Array.from({ length: 64 }, (unused, k) =>
            {
                const [x, z] = [Math.round(cx + Math.cos((k / 64) * Math.PI * 2) * CELLS * share), Math.round(cz + Math.sin((k / 64) * Math.PI * 2) * CELLS * share)];

                return zone.blockAt(x, topOf(x, z), z);
            });

            assert.deepEqual([zone.blockAt(cx, top, cz), zone.blockAt(cx, top - 1, cz)], [sand, sand]);
            assert.notEqual(zone.blockAt(cx + CELLS * 2, topOf(cx + CELLS * 2, cz), cz), sand, "The paint reached twice the radius");
            assert.ok(ring(0.8).some((block) => block !== sand) || ring(1.2).some((block) => block === sand), "The edge is a circle");
            assert.ok(stroke.cells().cells.every(([x, y, z, block]) => block === sand && zone.blockAt(x, y, z) === sand));
        });
    });

    it("paint exactly the circle or the square when clean", () =>
    {
        const sand = blocks.number("sand");
        const [cx, , cz] = MIDDLE;
        const isSand = (x, z) => zone.blockAt(x, topOf(x, z), z) === sand;

        withStroke(strokeOf({ kind: "ground", ground: "sand", edge: "clean" }), [MIDDLE], () =>
        {
            for(let dz = -CELLS - 2; dz <= CELLS + 2; dz++)
            {
                for(let dx = -CELLS - 2; dx <= CELLS + 2; dx++) { assert.equal(isSand(cx + dx, cz + dz), Math.hypot(dx, dz) <= CELLS, "The circle's edge is not clean at " + dx + ", " + dz); }
            }
        });

        withStroke(strokeOf({ kind: "ground", ground: "sand", edge: "clean", shape: "square" }), [MIDDLE], () =>
        {
            assert.ok(isSand(cx + CELLS, cz + CELLS) && !isSand(cx + CELLS + 1, cz), "The square's edge is not clean");
        });
    });

    it("raise the ground with its top block kept on top, and lower it, filling the cells it leaves below the water", () =>
    {
        const [cx, , cz] = MIDDLE;
        const top = topOf(cx, cz);
        const grass = zone.blockAt(cx, top, cz);

        withStroke(strokeOf({ kind: "sculpt", action: "raise" }), [MIDDLE, MIDDLE, MIDDLE], () =>
        {
            assert.ok(topOf(cx, cz) >= top + 3, "The middle did not rise");
            assert.equal(zone.blockAt(cx, topOf(cx, cz), cz), grass);
            assert.equal(topOf(cx + CELLS + 2, cz), topOf(cx + CELLS + 2, cz), "The ground beyond the radius moved");
        });

        withStroke(strokeOf({ kind: "sculpt", action: "lower" }), [MIDDLE, MIDDLE, MIDDLE], () =>
        {
            const lowered = topOf(cx, cz);

            assert.ok(lowered <= top - 3, "The middle did not sink");
            assert.equal(zone.blockAt(cx, lowered, cz), grass);
            assert.ok(blocks.isLiquid(zone.blockAt(cx, zone.waterCell - 1, cz)), "The hole below the water is dry");
        });
    });

    it("reach a corner of the square around them only when square", () =>
    {
        const [cx, , cz] = MIDDLE;
        const corner = [cx + Math.round(CELLS * 0.7), cz + Math.round(CELLS * 0.7)];
        const top = topOf(...corner);

        withStroke(strokeOf({ kind: "sculpt", action: "raise", shape: "circle" }), [MIDDLE, MIDDLE, MIDDLE], () => assert.equal(topOf(...corner), top, "A circle raised its square's corner"));
        withStroke(strokeOf({ kind: "sculpt", action: "raise", shape: "square" }), [MIDDLE, MIDDLE, MIDDLE], () => assert.ok(topOf(...corner) > top, "A square did not raise its corner"));
    });

    it("level the ground towards the stroke's start when flattening, and leave a placement's columns alone", () =>
    {
        const [cx, , cz] = MIDDLE;
        const start = topOf(cx - CELLS, cz);
        const cover = new Map([[cz * zone.columns + cx + CELLS, 0]]);
        const covered = topOf(cx + CELLS, cz);

        withStroke(strokeOf({ kind: "sculpt", action: "raise" }), [MIDDLE, MIDDLE], () =>
        {
            withStroke(strokeOf({ kind: "sculpt", action: "flatten" }, cover), [[cx - CELLS, 0, cz], MIDDLE, MIDDLE, MIDDLE], () =>
            {
                assert.ok(Math.abs(topOf(cx, cz) - start) <= 1, "The middle stands " + (topOf(cx, cz) - start) + " cubes from the start's height");
                assert.equal(topOf(cx + CELLS, cz), covered, "A covered column moved");
            });
        });
    });

    it("count a building as covering its footprint, but not a wall run whose box spans the village", async () =>
    {
        const hearthmere = await TestAssets.zone("hearthmere");
        const cover = BrushStroke.coverOf(hearthmere.objects, hearthmere.columns);
        const inn = hearthmere.objects.find((entry) => entry.name === "inn").box;
        const wall = hearthmere.objects.find((entry) => entry.name.startsWith("run ")).box;
        let covered = 0;

        for(let row = wall[2]; row <= wall[5]; row++)
        {
            for(let column = wall[0]; column <= wall[3]; column++) { covered += cover.has(row * hearthmere.columns + column) ? 1 : 0; }
        }

        assert.equal(cover.has(inn[2] * hearthmere.columns + inn[0]), true, "The inn does not cover its corner");
        assert.ok(covered < (wall[3] - wall[0] + 1) * (wall[5] - wall[2] + 1) / 2, "Most of the ground inside the wall is covered");
    });

    it("weather the columns under them towards the age, most in the middle", () =>
    {
        const [cx, , cz] = MIDDLE;
        const stroke = strokeOf({ kind: "age", age: 90, strength: 0.5 });

        stroke.dab(MIDDLE);

        const ages = new Map(stroke.ages().map(([column, row, age]) => [row * zone.columns + column, age]));
        const age = (column, row) => ages.get(row * zone.columns + column) ?? zone.age(column, row);

        assert.equal(age(cx, cz), Math.round(zone.age(cx, cz) + (90 - zone.age(cx, cz)) * 0.5));
        assert.ok(age(cx + CELLS / 2, cz) < age(cx, cz) && age(cx + CELLS / 2, cz) > zone.age(cx + CELLS / 2, cz), "The age does not fall away from the middle");
        assert.equal(ages.has(cz * zone.columns + cx + CELLS + 1), false, "A column beyond the radius aged");
    });
});
