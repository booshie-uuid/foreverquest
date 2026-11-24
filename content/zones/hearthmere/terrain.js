import * as Buildings from "../../props/buildings.js";
import * as Noise from "../../art/noise.js";

// Hearthmere, rebuilt: a walled village on flat ground, its roads cobbled and
// its lanes mud, a river in a channel to the east, hills to the north and
// fields to the south. Positions here are metres from the zone's middle.

const SEED = 4242;
const GRASS = 0;
const MOSS = 1;
const MUD = 2;
const COBBLE = 3;
const SAND = 4;
const ROCK = 6;
const VILLAGE = 2;
const WALLS = { west: -58, east: 38, north: -58, south: 48 };
const SQUARE = { west: -16, east: 8, north: -18, south: 6 };
const ROADS = [[[-4, 96], [-4, -35]], [[-36, -6], [74, -6]]];
const LANES =
[
    [[-36, -6], [-39, -6], [-39, -20], [-41, -20]], [[-39, -6], [-39, 18], [-41, 18]],
    [[-27, -6], [-27, -10]], [[-27, -6], [-27, 0]], [[-4, 17], [-8, 17]], [[-4, 15.5], [0, 15.5]], [[-4, 27], [0, 27]],
    [[-4, 35.5], [-8, 35.5]], [[21, -6], [21, -9]], [[27, -6], [27, 0]], [[13.5, -6], [13.5, 0]],
    [[30, -6], [30, -50], [36, -53]], [[-0.4, -40], [4, -40]], [[-4, 70], [-60, 70], [-65, 66]],
];
const FIELDS = [[-70, 74, -30, 92], [6, 62, 36, 88]];
const FLAT = 4;
const RAMP = 10;
const ROLL = { village: 2, outside: 5 };
const CHAPEL = { width: 22, depth: 40 };
const plotsOf = new WeakMap();

// The footprint of each building placed in the zone, in metres, as
// [x0, z0, x1, z1].
function plots(zone)
{
    if(!plotsOf.has(zone))
    {
        const sized = zone.props.filter((prop) => Buildings.BUILDINGS[prop.prefab] || prop.prefab === "chapel");

        plotsOf.set(zone, sized.map((prop) =>
        {
            const { width, depth } = Buildings.BUILDINGS[prop.prefab] ?? CHAPEL;
            const isTurned = Math.round(Math.abs(prop.angle ?? 0) / (Math.PI / 2)) % 2 === 1;
            const [across, along] = (isTurned ? [depth, width] : [width, depth]).map((cubes) => cubes / 6);

            return [prop.x - across, prop.z - along, prop.x + across, prop.z + along];
        }));
    }

    return plotsOf.get(zone);
}

function distanceToBox([x0, z0, x1, z1], x, z)
{
    return Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(z0 - z, 0, z - z1));
}

function riverX(z)
{
    return 58 + Math.sin(z / 30) * 4;
}

// The distance from a point to the nearest segment of any of `lines`.
function distanceTo(lines, x, z)
{
    let nearest = Infinity;

    for(const line of lines)
    {
        for(let i = 0; i < line.length - 1; i++)
        {
            const [[ax, az], [bx, bz]] = [line[i], line[i + 1]];
            const length = (bx - ax) ** 2 + (bz - az) ** 2;
            const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / length));

            nearest = Math.min(nearest, Math.hypot(x - ax - t * (bx - ax), z - az - t * (bz - az)));
        }
    }

    return nearest;
}

function isInside(box, x, z)
{
    return x >= box[0] && z >= box[1] && x <= box[2] && z <= box[3];
}

export function column(zone, x, z)
{
    const half = zone.columns / 6;
    const mx = (x + 0.5) / 3 - half;
    const mz = (z + 0.5) / 3 - half;
    const isVillage = mx >= WALLS.west - 2 && mx <= WALLS.east + 2 && mz >= WALLS.north - 2 && mz <= WALLS.south + 2;
    const river = Math.abs(mx - riverX(mz));
    const hills = Math.max(0, -62 - mz) * 0.55 + Math.max(0, -62 - mz) * Noise.fractal(SEED, x, z, 90, 3) * 0.5;
    const built = Math.min(distanceTo(ROADS, mx, mz) - 2.5, distanceTo(LANES, mx, mz) - 1, ...plots(zone).map((plot) => distanceToBox(plot, mx, mz)), isInside([SQUARE.west, SQUARE.north, SQUARE.east, SQUARE.south], mx, mz) ? 0 : Infinity);
    const openness = Math.max(0, Math.min(1, (built - FLAT) / RAMP));
    const swell = (Noise.fractal(SEED + 3, x, z, 75, 3) - 0.42) * 2;
    const roll = Math.max(-1, Math.round(swell * openness * (isVillage ? ROLL.village : ROLL.outside)));
    let surface = zone.base + VILLAGE + Math.round(hills) + roll;
    let ground = GRASS;

    if(river < 6 && !isVillage) { surface = Math.min(surface, zone.base + VILLAGE - Math.round((6 - Math.max(river, 3)) * 1.2)); }
    if(river < 3) { surface = zone.base - 3; }

    if(river < 4) { ground = SAND; }
    else if(river < 7) { ground = MOSS; }
    else if(distanceTo(ROADS, mx, mz) < 2.5 || isInside([SQUARE.west, SQUARE.north, SQUARE.east, SQUARE.south], mx, mz)) { ground = COBBLE; }
    else if(distanceTo(LANES, mx, mz) < 1) { ground = MUD; }
    else if(FIELDS.some((field) => isInside(field, mx, mz))) { ground = Math.floor(mz) % 2 === 0 ? MUD : GRASS; }
    else if(hills > 12) { ground = ROCK; }
    else if(Noise.value(SEED + 13, x, z, 60) > 0.7) { ground = MOSS; }

    return [surface, ground];
}
