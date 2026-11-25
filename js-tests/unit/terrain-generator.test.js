import * as Generator from "../../tools/terrain/generator.js";
import * as Png from "../../js/engine/png.js";
import * as Recipe from "../../tools/terrain/recipe.js";
import * as Terrain from "../../tools/bake/terrain.js";
import * as TerrainMap from "../../tools/terrain/map.js";
import * as assert from "node:assert/strict";
import { describe, it } from "node:test";

const CUBES = 3;
const ZONE = { columns: 384, height: 256, base: 48, water: 45 };
const HALF = ZONE.columns / CUBES / 2;
const ROCK = Generator.GROUND.findIndex((ground) => ground.top === "rock");

// A recipe of the default hills with no edges, changed by `change`.
function recipe(change = {})
{
    const open = Recipe.starter();

    for(const side of Recipe.SIDES) { open.edges[side] = { kind: "none" }; }

    return { ...open, ...change, edges: { ...open.edges, ...change.edges } };
}

function cliffs(band, height, foot = 4)
{
    return { kind: "cliffs", band, height, foot };
}

// The column under a point in metres from the zone's middle.
function columnAt(x, z)
{
    return Math.floor((z + HALF) * CUBES) * ZONE.columns + Math.floor((x + HALF) * CUBES);
}

function metresOf(surface)
{
    return (surface - ZONE.base) / CUBES;
}

describe("The terrain generator", () =>
{
    it("runs the same recipe to the same columns and cells", () =>
    {
        const river = { kind: "river", points: [[-60, 0], [64, 10]], width: 6, valley: 10, start: "none", end: "arch" };
        const made = recipe({ edges: { east: cliffs(30, 20) }, features: [river] });
        const first = Generator.generate(ZONE, made);
        const second = Generator.generate(ZONE, made);

        assert.deepEqual(first.surfaces, second.surfaces);
        assert.deepEqual(first.grounds, second.grounds);
        assert.deepEqual(first.cells, second.cells);
    });

    it("levels a flat area to the ground it replaces, keeps its roll, and blends it into the hills without a cliff", () =>
    {
        const flat = { kind: "flat", x: 0, z: 0, width: 60, length: 40, level: "ground", height: 1.5, blend: 20, roll: 0.5 };
        const hills = Generator.generate(ZONE, recipe());
        const { surfaces, grounds } = Generator.generate(ZONE, recipe({ features: [flat] }));
        const inside = [];
        const replaced = [];

        for(let z = -18; z <= 18; z += 0.5)
        {
            for(let x = -28; x <= 28; x += 0.5)
            {
                inside.push(metresOf(surfaces[columnAt(x, z)]));
                replaced.push(metresOf(hills.surfaces[columnAt(x, z)]));
            }
        }

        const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;

        assert.ok(Math.max(...inside) - Math.min(...inside) <= 2 * flat.roll + 2 / CUBES, "The area rolls more than its setting");
        assert.ok(Math.abs(mean(inside) - mean(replaced)) < 0.5, "The area is not level with the ground it replaced");

        for(let z = -40; z <= 40; z += 1 / CUBES)
        {
            for(let x = -50; x <= 50; x += 1 / CUBES) { assert.notEqual(grounds[columnAt(x, z)], ROCK, "The area or its blend has a rock face at " + x + ", " + z); }
        }
    });

    it("sets a flat area a height above the water when asked", () =>
    {
        const flat = { kind: "flat", x: 0, z: 0, width: 60, length: 40, level: "water", height: 1.5, blend: 20, roll: 0.5 };
        const { surfaces } = Generator.generate(ZONE, recipe({ features: [flat] }));
        const water = metresOf(ZONE.water);

        for(const [x, z] of [[0, 0], [-25, -15], [25, 15]])
        {
            const height = metresOf(surfaces[columnAt(x, z)]) - water;

            assert.ok(Math.abs(height - flat.height) <= flat.roll + 1 / CUBES, "The area is " + height + " m above the water at " + x + ", " + z);
        }
    });

    it("sinks a lake's floor below the water, and a hollow's below the ground it replaces", () =>
    {
        const box = { x: 0, z: 0, width: 60, length: 40, drop: 4, blend: 20 };
        const hills = Generator.generate(ZONE, recipe());
        const lake = Generator.generate(ZONE, recipe({ features: [{ kind: "basin", floor: "water", ...box }] }));
        const hollow = Generator.generate(ZONE, recipe({ features: [{ kind: "basin", floor: "ground", ...box }] }));
        const water = metresOf(ZONE.water);
        const middle = columnAt(0, 0);

        assert.ok(metresOf(hills.surfaces[middle]) > water + 2, "The hills are not dry in the middle");
        assert.ok(Math.abs(metresOf(lake.surfaces[middle]) - (water - box.drop)) <= 1 / CUBES, "The lake's floor is not " + box.drop + " m below the water");
        assert.ok(metresOf(hollow.surfaces[middle]) > water, "The hollow holds water");
        assert.ok(metresOf(hollow.surfaces[middle]) < metresOf(hills.surfaces[middle]), "The hollow does not sink the ground");
    });

    for(const level of ["water", "ground"])
    {
        it("keeps a lake's water when a later flat area overlaps its shore, and slopes down to it, at a level of " + level, () =>
        {
            const lake = { kind: "basin", floor: "water", x: -30, z: 0, width: 50, length: 50, drop: 4, blend: 10 };
            const flat = { kind: "flat", x: 20, z: 0, width: 60, length: 50, level, height: 1.5, blend: 30, roll: 0 };
            const alone = Generator.generate(ZONE, recipe({ features: [lake] }));
            const shored = Generator.generate(ZONE, recipe({ features: [lake, flat] }));

            for(let x = -55; x <= 20; x += 1 / CUBES)
            {
                const column = columnAt(x, 0);
                const isWet = alone.surfaces[column] < ZONE.water;

                assert.equal(shored.surfaces[column] < ZONE.water, isWet, "The flat area changed the shore at x " + x);
                assert.ok(Math.abs(shored.surfaces[columnAt(x + 1 / CUBES, 0)] - shored.surfaces[column]) <= 2, "The shore drops sheer at x " + x);

                if(isWet) { assert.equal(shored.surfaces[column], alone.surfaces[column], "The flat area filled the lake at x " + x); }
            }
        });
    }

    it("adds hills inside a hilly area and along a hilly band, keeps their average, and leaves the ground beyond alone", () =>
    {
        const level = { base: { kind: "flat", height: 10 } };
        const area = { kind: "hilly", x: -20, z: 0, width: 50, length: 50, height: 16, size: 40, blend: 10 };
        const band = { kind: "hillyBand", points: [[-60, -40], [60, -40]], width: 20, height: 16, size: 40, blend: 10 };
        const before = Generator.generate(ZONE, recipe(level));
        const after = Generator.generate(ZONE, recipe({ ...level, features: [area, band] }));
        const heights = (surfaces, points) => points.map(([x, z]) => metresOf(surfaces[columnAt(x, z)]));
        const spread = (values) => Math.max(...values) - Math.min(...values);
        const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
        const grid = (x0, x1, z0, z1) => Array.from({ length: 21 * 21 }, (unused, k) => [x0 + (x1 - x0) * (k % 21) / 20, z0 + (z1 - z0) * Math.floor(k / 21) / 20]);
        const inArea = grid(-40, 0, -20, 20);
        const inBand = grid(-55, 55, -44, -36);
        const beyond = grid(30, 60, 20, 60);

        assert.ok(spread(heights(after.surfaces, inArea)) > spread(heights(before.surfaces, inArea)) + area.height / 2, "The hilly area is no hillier");
        assert.ok(spread(heights(after.surfaces, inBand)) > spread(heights(before.surfaces, inBand)) + band.height / 2, "The hilly band is no hillier");
        assert.ok(Math.abs(mean(heights(after.surfaces, inArea)) - mean(heights(before.surfaces, inArea))) < area.height / 4, "The hilly area moved its average height");
        assert.deepEqual(heights(after.surfaces, beyond), heights(before.surfaces, beyond));
    });

    it("eases a hilly area's valleys down towards low ground without flooding them or leaving flat shores", () =>
    {
        const area = { kind: "hilly", x: 0, z: 0, width: 100, length: 100, height: 20, size: 40, blend: 10 };
        const { surfaces, grounds } = Generator.generate(ZONE, recipe({ features: [area] }));
        const sand = Generator.GROUND.findIndex((ground) => ground.top === "sand");

        for(let z = -50; z <= 50; z += 1)
        {
            for(let x = -50; x <= 50; x += 1)
            {
                assert.ok(surfaces[columnAt(x, z)] > ZONE.water, "A valley floods at " + x + ", " + z);
                assert.notEqual(grounds[columnAt(x, z)], sand, "A valley has a sandy shore at " + x + ", " + z);
            }
        }
    });

    it("raises a band of cliffs along a cliff edge, sinks a water edge below the water, and leaves the middle alone", () =>
    {
        const open = Generator.generate(ZONE, recipe());
        const edged = Generator.generate(ZONE, recipe({ edges: { north: cliffs(40, 20), south: { kind: "water", band: 40 } } }));
        const water = metresOf(ZONE.water);

        assert.deepEqual(Terrain.waterSides(ZONE, edged.surfaces), ["south"]);

        for(let x = -50; x <= 50; x += 5)
        {
            assert.ok(metresOf(edged.surfaces[columnAt(x, -HALF + 1)]) - metresOf(open.surfaces[columnAt(x, -HALF + 1)]) >= 20, "The north edge is not a cliff at x " + x);
            assert.ok(metresOf(edged.surfaces[columnAt(x, HALF - 1)]) < water, "The south edge is not under water at x " + x);
            assert.equal(edged.surfaces[columnAt(x, 0)], open.surfaces[columnAt(x, 0)]);
        }
    });

    it("carves a river below the water along its points", () =>
    {
        const river = { kind: "river", points: [[-60, -20], [0, 10], [60, 0]], width: 6, valley: 12, start: "none", end: "none" };
        const { surfaces, grounds } = Generator.generate(ZONE, recipe({ features: [river] }));
        const mud = Generator.GROUND.findIndex((ground) => ground.top === "mud");

        for(const [x, z] of [[-60, -20], [-30, -5], [0, 10], [30, 5], [59, 0]]) { assert.ok(surfaces[columnAt(x, z)] < ZONE.water, "The river is dry at " + x + ", " + z); }

        assert.equal(grounds[columnAt(0, 10 + river.width / 2 + 1)], mud, "The river's bank is not mud");
    });

    it("lets a river's width wander along its course, within a third of its setting either way", () =>
    {
        const river = { kind: "river", points: [[-HALF + 5, 0], [HALF - 5, 0]], width: 12, valley: 0, start: "none", end: "none" };
        const { surfaces } = Generator.generate(ZONE, recipe({ features: [river] }));
        const widths = [];

        for(let x = -HALF + 25; x <= HALF - 25; x += 2)
        {
            let wet = 0;

            for(let z = -15; z <= 15; z += 1 / CUBES) { if(surfaces[columnAt(x, z)] < ZONE.water) { wet += 1 / CUBES; } }

            widths.push(wet);
        }

        assert.ok(Math.max(...widths) - Math.min(...widths) >= river.width * 0.3, "The river's width does not vary: " + widths.join(", "));
        assert.ok(widths.every((width) => width >= river.width * 0.6 && width <= river.width * 1.45), "The river's width varies too far: " + widths.join(", "));
    });

    it("takes a river under the cliff, where a roof falls to meet the water", () =>
    {
        const river = { kind: "river", points: [[-40, 0], [HALF - 1, 0]], width: 6, valley: 8, start: "none", end: "arch" };
        const { surfaces, cells } = Generator.generate(ZONE, recipe({ edges: { east: cliffs(40, 24) }, features: [river] }));
        const air = cells.filter((cell) => cell[3] === "air");
        const deepest = Math.max(...air.map(([column]) => column));
        const roofs = (column) => air.filter((cell) => cell[0] === column).map(([, y]) => y);

        assert.ok(air.length > 0, "The river makes no tunnel");

        for(const [column, y, row] of air) { assert.ok(y >= ZONE.water && y < surfaces[row * ZONE.columns + column], "A tunnel cell is not between the water and the rock"); }

        assert.ok(Math.max(...roofs(deepest)) < Math.max(...roofs(Math.min(...air.map(([column]) => column)))), "The roof does not fall towards the tunnel's end");
        assert.ok(cells.filter((cell) => cell[3] === "water").every(([, y]) => y < ZONE.water), "The tunnel's water stands above the zone's level");
    });

    it("bends a gorge along the cliffs before the river goes under them", () =>
    {
        const river = { kind: "river", points: [[-40, 0], [HALF - 1, 0]], width: 6, valley: 8, start: "none", end: "gorge" };
        const { surfaces } = Generator.generate(ZONE, recipe({ edges: { east: cliffs(60, 24) }, features: [river] }));
        const wet = [];

        for(let z = -HALF; z < HALF; z += 1)
        {
            for(let x = HALF - 40; x < HALF; x += 1) { if(surfaces[columnAt(x, z)] < ZONE.water) { wet.push(z); } }
        }

        assert.ok(Math.max(...wet) - Math.min(...wet) >= 25, "The gorge does not turn along the edge");
    });

    it("pours a waterfall down the cliff from a notch near its top", () =>
    {
        const river = { kind: "river", points: [[0, -HALF + 1], [0, 40]], width: 6, valley: 8, start: "waterfall", end: "none" };
        const { cells, surfaces } = Generator.generate(ZONE, recipe({ edges: { north: cliffs(40, 24) }, features: [river] }));
        const falls = cells.filter((cell) => cell[3] === "water" && cell[1] >= ZONE.water);

        assert.ok(falls.length > 0, "The river has no waterfall");
        assert.ok(Math.max(...falls.map(([, y]) => y)) - ZONE.water >= 15 * CUBES, "The waterfall does not start high on the cliff");
        assert.ok(falls.every(([column, y, row]) => y < surfaces[row * ZONE.columns + column] && y >= surfaces[row * ZONE.columns + column] - 6), "The waterfall does not lie on the cliff's face");
    });

    it("cuts a pass straight through the cliffs to the edge, from the open ground even when its point lies on the cliffs", () =>
    {
        const pass = { kind: "pass", x: -HALF + 20, z: 0, width: 10 };
        const walled = Generator.generate(ZONE, recipe({ edges: { west: cliffs(40, 24) } }));
        const cut = Generator.generate(ZONE, recipe({ edges: { west: cliffs(40, 24) }, features: [pass] }));

        assert.ok(metresOf(walled.surfaces[columnAt(-HALF + 1, 0)]) - metresOf(cut.surfaces[columnAt(-HALF + 1, 0)]) >= 20, "The pass does not reach the edge straight out from its point");

        for(let x = -HALF + 1; x < -HALF + 70; x += 1 / CUBES) { assert.ok(Math.abs(cut.surfaces[columnAt(x + 1 / CUBES, 0)] - cut.surfaces[columnAt(x, 0)]) <= 2, "The pass's floor steps sheer at x " + x); }
    });

    it("rises gently at the cliffs' foot, a cube at a time, before the rock face", () =>
    {
        const open = Generator.generate(ZONE, recipe());
        const walled = Generator.generate(ZONE, recipe({ edges: { west: cliffs(40, 24, 4) } }));
        const lift = (x, z) => walled.surfaces[columnAt(x, z)] - open.surfaces[columnAt(x, z)];

        for(let z = -50; z <= 50; z += 5)
        {
            let x = 0;

            while(lift(x, z) < 2 * CUBES && x > -HALF) { x -= 1 / CUBES; }

            assert.ok(x > -HALF, "The cliffs do not rise at z " + z);

            for(let at = x; at < 0; at += 1 / CUBES) { assert.ok(lift(at - 1 / CUBES, z) - lift(at, z) <= 2, "The cliffs' foot steps sheer at " + at + ", " + z); }
        }
    });

    it("bounds a cliff side where the cliffs have risen 3 metres, and leaves a pass open to the edge", () =>
    {
        const pass = { kind: "pass", x: -HALF + 30, z: 0, width: 10 };
        const open = Generator.generate(ZONE, recipe());
        const walled = Generator.generate(ZONE, recipe({ edges: { west: cliffs(40, 24, 0) }, features: [pass] }));
        const lift = (x, z) => metresOf(walled.surfaces[columnAt(x, z)]) - metresOf(open.surfaces[columnAt(x, z)]);
        const bounds = walled.bounds.west;

        assert.deepEqual(Object.keys(walled.bounds), ["west"]);
        assert.equal(bounds.length, HALF * 2);
        assert.equal(bounds[HALF], 2, "The pass is closed");

        for(let k = 0; k < HALF - 20; k++)
        {
            const z = k + 0.5 - HALF;

            assert.ok(lift(-HALF + bounds[k] - 0.5, z) >= 3 - 1 / CUBES, "The bound at " + z + " lies in front of the cliffs");

            for(let d = bounds[k] + 0.5; d < 60; d += 1 / CUBES) { assert.ok(lift(-HALF + d, z) < 3, "The cliffs rise 3 m inside the bound at " + z + ", " + d + " m in"); }
        }
    });

    it("keeps a cliff side's bounds where they were when a river cuts through the cliffs", () =>
    {
        const river = { kind: "river", points: [[0, 0], [-HALF + 2, 0]], width: 8, valley: 20, start: "none", end: "none" };
        const walled = Generator.generate(ZONE, recipe({ edges: { west: cliffs(40, 24) } }));
        const cut = Generator.generate(ZONE, recipe({ edges: { west: cliffs(40, 24) }, features: [river] }));

        assert.ok(metresOf(cut.surfaces[columnAt(-HALF + 1, 0)]) < metresOf(ZONE.water), "The river does not cut through the cliffs");
        assert.deepEqual(cut.bounds, walled.bounds);
    });

    it("fills a cliff with earth at its foot, then patches of rock, then rock alone from 18 metres up", () =>
    {
        const zone = { ...ZONE, terrain: recipe({ edges: { west: cliffs(60, 30) } }) };
        const terrain = Terrain.generateColumns(zone, "Zone", []);
        const ground = Generator.GROUND.map((unused, i) => ({ top: 10 + i, under: 20 + i }));
        const region = Terrain.composeRegion(ZONE, terrain, ground, { rock: 1, earth: 2, water: 3 }, 0, 0);
        const chunks = new Map(region.chunks.map((chunk) => [chunk.x + "," + chunk.y + "," + chunk.z, chunk.cells]));
        const cellAt = (x, y, z) => chunks.get([x >> 5, y >> 5, z >> 5].join(","))?.[((y & 31) * 32 + (z & 31)) * 32 + (x & 31)] ?? 0;
        const kinds = { low: [], middle: [], high: [] };

        for(let row = 0; row < 256; row += 3)
        {
            for(let column = 0; column < 180; column += 3)
            {
                const foot = terrain.foots[row * ZONE.columns + column];
                const surface = terrain.surfaces[row * ZONE.columns + column];

                for(let y = foot + CUBES; foot > 0 && y < surface - 1; y++)
                {
                    const lift = (y - foot) / CUBES;
                    const band = lift < 2 ? "low" : lift >= 18 ? "high" : lift >= 8 && lift < 11 ? "middle" : null;

                    if(band) { kinds[band].push(cellAt(column, y, row)); }
                }
            }
        }

        const rocky = (cells) => cells.filter((cell) => cell === 1).length / cells.length;

        assert.ok(kinds.low.length > 100 && kinds.middle.length > 100 && kinds.high.length > 100, "The cliffs are too low to test");
        assert.ok(rocky(kinds.low) < 0.1, "The cliffs' foot is " + rocky(kinds.low) + " rock");
        assert.ok(rocky(kinds.middle) > 0.2 && rocky(kinds.middle) < 0.8, "The cliffs' middle is " + rocky(kinds.middle) + " rock");
        assert.equal(rocky(kinds.high), 1, "The cliffs' upper part is not all rock");
    });

    it("turns steep faces to rock, shores to sand, and leaves the hills grass, moss or mud", () =>
    {
        const { grounds } = Generator.generate(ZONE, recipe({ edges: { north: cliffs(40, 24), south: { kind: "water", band: 40 } } }));
        const kinds = (row) => new Set(Array.from({ length: ZONE.columns }, (unused, column) => Generator.GROUND[grounds[row * ZONE.columns + column]].top));

        assert.deepEqual([...kinds(0)], ["rock"]);
        assert.ok(kinds(ZONE.columns / 2).isSubsetOf(new Set(["grass", "moss", "mud", "sand"])));
        assert.ok([...Array(ZONE.columns).keys()].some((row) => kinds(row).has("sand")), "No shore turned to sand");
    });
});

describe("Terrain recipes", () =>
{
    it("accept the starter recipe and name what is wrong with a broken one", () =>
    {
        const broken = recipe({ base: { kind: "mountains" }, edges: { east: { kind: "cliffs", band: 5, height: 28, foot: 4 } }, features: [{ kind: "flat", x: 999, z: 0, width: 10, length: 10, level: "water", blend: 0, roll: 0 }, { kind: "river", points: [[0, 0]], width: 6, valley: 0, start: "spring", end: "none" }, { kind: "lake" }] });

        assert.deepEqual(Recipe.check(Recipe.starter(), 1024), []);
        assert.deepEqual(Recipe.check(broken, 128),
        [
            "The terrain needs a base, one of flat, hills.",
            "The east edge's band needs to be a number from 20 to 120.",
            "Feature 1's above water needs to be a number from 0 to 30.",
            "Feature 1 needs a middle inside the zone.",
            "Feature 2's start needs to be one of none, waterfall.",
            "Feature 2 needs two or more points inside the zone.",
            "Feature 3 needs a kind, one of flat, basin, rise, hilly, hillyBand, river, pass.",
        ]);
    });
});

describe("Terrain maps", () =>
{
    it("draw a recipe from above as a PNG, with water and rock where the generator puts them", async () =>
    {
        const url = TerrainMap.render(ZONE, recipe({ edges: { north: cliffs(40, 24), south: { kind: "water", band: 40 } } }));
        const image = await Png.decode(new Uint8Array(Buffer.from(url.replace("data:image/png;base64,", ""), "base64")));
        const pixel = (x, y) => Array.from(image.data.subarray((y * image.width + x) * 4, (y * image.width + x) * 4 + 3));

        assert.deepEqual([image.width, image.height], [ZONE.columns, ZONE.columns]);
        assert.deepEqual(pixel(ZONE.columns / 2, ZONE.columns - 1), [46, 66, 84], "The south edge is not drawn as water");
        assert.ok(pixel(ZONE.columns / 2, ZONE.columns / 2)[1] > pixel(ZONE.columns / 2, ZONE.columns / 2)[2], "The middle is not drawn green");
    });
});
