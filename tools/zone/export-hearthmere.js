import * as Props from "../../js/world/props.js";
import * as Residents from "../../js/game/residents.js";
import * as fs from "node:fs";
import * as path from "node:path";
import { AssetSource } from "../../js/engine/asset-source.js";
import { Log } from "../../js/log.js";
import { PropBuilder } from "../../js/world/prop-builder.js";
import { Random } from "../../js/util/random.js";
import { Terrain } from "../../js/world/terrain.js";
import { WorldAtlas } from "../../js/engine/world-atlas.js";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const OUTPUT = path.join(ROOT, "content", "zones", "hearthmere.json");
const SEED = 7;
const VARIANTS = 8;
const TYPE_CODES = { grass: "g", moss: "m", mud: "d", cobble: "c", sand: "s", stone: "t", darkStone: "k" };
const HOUSE_PREFABS = ["house.inn", "house.thatch", "house.slate", "house.croft"];

// Replays the prototype's World constructor with the same random stream, so
// every position, scale and collider matches, and records each prop call as a
// placement or a run.
class Recorder
{
    constructor(terrain, builder)
    {
        this.terrain = terrain;
        this.builder = builder;
        this.colliders = [];
        this.props = [];
        this.counts = new Map();
    }

    height(x, z)
    {
        return this.terrain.heightAt(x, z);
    }

    variant(species)
    {
        const count = this.counts.get(species) ?? 0;

        this.counts.set(species, count + 1);

        return species + "." + (count % VARIANTS);
    }

    place(prefab, x, z, angle, result, scale = 1)
    {
        const entry = { prefab, x: round(x), z: round(z), angle: round(angle) };

        if(scale !== 1) { entry.scale = round(scale); }

        this.props.push(entry);

        if(result) { this.colliders.push(result.collider ?? result); }
    }

    run(points)
    {
        this.props.push({ run: "fence", points });
        this.colliders.push(...Props.fence(this.builder, points, (x, z) => this.height(x, z)));
    }

    isCrowded(x, z, gap)
    {
        return this.colliders.some((collider) => Math.hypot(collider.x - x, collider.z - z) < gap + (collider.radius ?? Math.max(collider.halfWidth, collider.halfDepth)));
    }
}

// Angles that the prototype drew inside a prop's own function, which the
// variants now carry, come from the position instead.
function spin(x, z, range)
{
    return round(new Random(Math.round(x * 1000) * 31 + Math.round(z * 1000)).range(0, range));
}

function round(value)
{
    return Math.round(value * 1e6) / 1e6;
}

/* PROTOTYPE LAYOUT ***********************************************************/

function village(r, random)
{
    const b = r.builder;
    const houses =
    [
        { angle: -0.79, radius: 12, style: { width: 5, depth: 4, roof: "slate", isLit: true, sign: true } },
        { angle: -2.44, radius: 12, style: { width: 4.4, depth: 4, roof: "thatch", isLit: false } },
        { angle: 2.18, radius: 12, style: { width: 5.2, depth: 4.2, roof: "slate", isLit: true } },
        { angle: 0.96, radius: 12, style: { width: 4.6, depth: 3.8, roof: "thatch", isLit: false } },
    ];

    r.place("well", 0, 0, 0, Props.well(b, 0, r.height(0, 0), 0));
    r.place("stocks", 3.6, -3.4, 0.5, Props.stocks(b, 3.6, r.height(3.6, -3.4), -3.4, 0.5));

    for(const angle of [0.4, 1.95, 3.55, 5.1])
    {
        const x = Math.cos(angle) * 6.6;
        const z = Math.sin(angle) * 6.6;

        r.place("lampPost", x, z, -angle, Props.lampPost(b, x, r.height(x, z), z, -angle));
    }

    houses.forEach(({ angle, radius, style }, i) =>
    {
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const barrelX = x + Math.cos(angle + 0.6) * -3.4;
        const barrelZ = z + Math.sin(angle + 0.6) * -3.4;

        r.place(HOUSE_PREFABS[i], x, z, Math.atan2(-x, -z), Props.house(b, x, r.height(x, z), z, Math.atan2(-x, -z), style));

        const barrelAngle = random.range(0, 1);

        r.place("barrel", barrelX, barrelZ, barrelAngle, Props.barrel(b, barrelX, r.height(x, z), barrelZ, barrelAngle));
    });

    r.place("cottage", 13.6, -2.4, Math.atan2(-13.6, 2.4), Props.cottage(b, 13.6, r.height(13.6, -2.4), -2.4, Math.atan2(-13.6, 2.4)));
    r.place("cottage", -13.2, -4.8, Math.atan2(13.2, 4.8), Props.cottage(b, -13.2, r.height(-13.2, -4.8), -4.8, Math.atan2(13.2, 4.8)));
    r.place("cart", -4.4, 4.6, 0.7, Props.cart(b, -4.4, r.height(-4.4, 4.6), 4.6, 0.7));
    r.place("sacks", -6.2, 3.2, 0.4, Props.sacks(b, -6.2, r.height(-6.2, 3.2), 3.2, 0.4));

    for(const [x, z, size] of [[5.2, -6.8, 0.7], [5.9, -6.2, 0.55], [-7.2, -3.2, 0.65], [-7.6, -2.5, 0.5]])
    {
        const angle = random.range(0, 1);

        r.place("crate" + Math.round(size * 100), x, z, angle, Props.crate(b, x, r.height(x, z), z, size, angle));
    }

    r.place("signpost", -14.5, 3.6, 0.3, Props.signpost(b, -14.5, r.height(-14.5, 3.6), 3.6, 0.3));
    r.place("gibbet", -25, 7.5, 1.2, Props.gibbet(b, -25, r.height(-25, 7.5), 7.5, 1.2));
    r.run([[-18, 12], [-12, 18], [-6, 20], [-2, 24]]);
}

function chapelGrounds(r, random)
{
    const b = r.builder;

    r.place("chapel", -9, -22, 0, Props.chapel(b, -9, r.height(-9, -22), -22, 0));

    for(let row = 0; row < 3; row++)
    {
        for(let column = 0; column < 4; column++)
        {
            if(random.chance(0.2)) { continue; }

            const x = 1.5 + column * 1.6 + random.range(-0.2, 0.2);
            const z = -18 - row * 2.4 + random.range(-0.2, 0.2);
            const angle = random.range(-0.15, 0.15);

            r.place(r.variant("grave"), x, z, angle, Props.grave(b, x, r.height(x, z), z, angle, random));
        }
    }

    r.run([[0, -15.5], [8.5, -15.5], [8.5, -25.5], [0, -25.5]]);
    r.place(r.variant("deadTree"), 7, -27.5, spin(7, -27.5, Math.PI), Props.deadTree(b, 7, r.height(7, -27.5), -27.5, 1.2, random), 1.2);
}

function wilds(r, random)
{
    const b = r.builder;
    const terrain = r.terrain;

    for(let i = 0; i < 900; i++)
    {
        const x = random.range(-44, 44);
        const z = random.range(-44, 44);
        const y = terrain.heightAt(x, z);
        const isForest = Math.hypot(x + 26, z + 24) < 16 || Math.hypot(x - 30, z + 28) < 12;
        const odds = isForest ? 0.55 : y > 1.5 ? 0.12 : 0.05;

        if(Math.hypot(x, z) < 19 || terrain.isWater(x, z) || Terrain.pathDistance(x, z) < 2) { continue; }
        if(!random.chance(odds) || r.isCrowded(x, z, 1.4)) { continue; }

        const roll = random.next();
        const scale = random.range(0.8, 1.3);

        if(roll < 0.62) { r.place(r.variant("pine"), x, z, spin(x, z, Math.PI / 2), Props.pine(b, x, y, z, scale, random), scale); }
        else if(roll < 0.82) { r.place(r.variant("deadTree"), x, z, spin(x, z, Math.PI), Props.deadTree(b, x, y, z, scale, random), scale); }
        else { r.place(r.variant("oak"), x, z, spin(x, z, Math.PI / 2), Props.oak(b, x, y, z, scale, random), scale); }
    }

    for(let i = 0; i < 160; i++)
    {
        const x = random.range(-44, 44);
        const z = random.range(-44, 44);
        const y = terrain.heightAt(x, z);

        if(Math.hypot(x, z) < 8 || terrain.isWater(x, z) || Terrain.pathDistance(x, z) < 1.4 || r.isCrowded(x, z, 1)) { continue; }

        const roll = random.next();

        if(roll < 0.3)
        {
            const scale = random.range(0.5, 1.4);

            r.place(r.variant("rock"), x, z, spin(x, z, 3), Props.rock(b, x, y, z, scale, random), scale);
        }
        else if(roll < 0.55)
        {
            const scale = random.range(0.8, 1.3);

            Props.bush(b, x, y, z, scale, random);
            r.place(r.variant("bush"), x, z, spin(x, z, 3), null, scale);
        }
        else
        {
            Props.weeds(b, x, y, z, random);
            r.place(r.variant("weeds"), x, z, 0, null);
        }
    }
}

/* ZONE FILE ******************************************************************/

function tiles(terrain)
{
    const levels = [];
    const types = [];

    for(let row = 0; row < terrain.size; row++)
    {
        levels.push(Array.from(terrain.levels.subarray(row * terrain.size, (row + 1) * terrain.size)).join(","));
        types.push(terrain.types.slice(row * terrain.size, (row + 1) * terrain.size).map((type) => TYPE_CODES[type]).join(""));
    }

    return { levels, types };
}

function people()
{
    return {
        seed: 4242,
        residents: Residents.RESIDENTS.map((resident) => ({ npc: resident.look.name.toLowerCase(), home: resident.home, roam: resident.roam })),
        crowd: { count: 7, centre: [0, 0], radius: 11, startAngle: 0.3, roam: 9, lines: "villager", archetypes: [null, "villager", "villager"] },
    };
}

// One line per tile row and per prop, so a diff shows what changed.
function stringify(zone)
{
    const { levels, types, props, ...rest } = zone;
    const head = JSON.stringify(rest, null, 4).slice(0, -2);
    const list = (name, values) => "    \"" + name + "\":\n    [\n" + values.map((value) => "        " + JSON.stringify(value)).join(",\n") + "\n    ]";

    return head + ",\n" + [list("levels", levels), list("types", types), list("props", props)].join(",\n") + "\n}\n";
}

async function main()
{
    if(fs.existsSync(OUTPUT))
    {
        Log.error(OUTPUT + " exists. Hearthmere is exported once from the prototype's generator.");
        process.exitCode = 1;
        return;
    }

    const assets = await AssetSource.open((file) => fs.promises.readFile(path.join(ROOT, "assets", file)));
    const terrain = new Terrain(SEED);
    const recorder = new Recorder(terrain, new PropBuilder(await WorldAtlas.load(assets)));
    const random = new Random(SEED * 31 + 5);

    village(recorder, random);
    chapelGrounds(recorder, random);
    wilds(recorder, random);

    const zone =
    {
        id: "hearthmere",
        name: "Hearthmere",
        size: terrain.size,
        step: Terrain.STEP,
        waterLevel: Terrain.WATER_LEVEL,
        typeCodes: Object.fromEntries(Object.entries(TYPE_CODES).map(([type, code]) => [code, type])),
        ...tiles(terrain),
        lighting:
        {
            sky: { top: "#0e1118", horizon: "#262b34" },
            fog: { near: 14, far: 58 },
            hemisphere: { sky: "#6a7488", ground: "#221b14", intensity: 1.5 },
            moon: { colour: "#a8b8d8", intensity: 1.7 },
            lamp: { colour: "#ff9a40", intensity: 5, distance: 8, decay: 1.6 },
        },
        spawn: { x: 1.6, z: 9.5, heading: Math.PI },
        people: people(),
        props: recorder.props,
    };

    fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
    fs.writeFileSync(OUTPUT, stringify(zone));
    Log.info("Exported " + recorder.props.length + " props and " + recorder.colliders.length + " colliders to " + OUTPUT);
}

await main();
