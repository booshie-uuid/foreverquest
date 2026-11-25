import * as Bases from "../../content/terrain/bases.js";
import * as Noise from "../../content/art/noise.js";
import * as Recipe from "./recipe.js";
import { ZoneData } from "../../js/sim/zone-data.js";

const CUBES = ZoneData.CUBES_PER_METRE;

// The ground types the generator chooses from, by index.
export const GROUND =
[
    { top: "grass", under: "earth" },
    { top: "moss", under: "earth" },
    { top: "mud", under: "earth" },
    { top: "sand", under: "sand" },
    { top: "rock", under: "rock" },
];

const [GRASS, MOSS, MUD, SAND, ROCK] = [0, 1, 2, 3, 4];

export const MARKS = { bank: 1, pass: 2, fall: 4 };

// Lengths in metres. A cliff's foot is where its edge has lifted the ground
// by FOOT; an arch opens where the lift reaches MOUTH; movement stops where
// it reaches CLIMB.
const FOOT = 2;
const CLIMB = 3;
const MOUTH = 5;
const BED = 1.5;
const POOL = 3;
const ARCH = { height: 3, length: 10 };
const GORGE = { valley: 1, inward: 0.4, along: 30 };
const FALL = { width: 4, top: 0.7, notch: 6, notchWidth: 6, step: 6 };
const PASS = { rise: 3, banks: 4 };
const WATER_DEPTH = 3;
const ROCK_SLOPE = 2;
const SHORE = 0.4;
const SEEDS = { wobble: 66, rough: 71, roll: 77, river: 55, damp: 13, shore: 83, hilly: 97, stone: 101 };

// Cliffs turn from earth and grass at their foot to rock, by patches, from
// FROM to TO metres above it.
const GRADE = { from: 1, to: 18 };
const BASIN = { round: 0.45, wobble: 0.12 };

// The slope at a cliff's foot reaches its full height a share REACH of the
// way into the band, and varies along it from LEAST of that height.
const APRON = { reach: 0.25, least: 0.6 };
const RIVER = { narrowest: 0.7, widest: 1.3, wander: 40, ends: 15 };
// A hilly feature's valleys ease towards CLEAR metres above the water and
// never reach it.
const HILLY = { deviations: 4, least: 0.05, clear: 1 };

// A flat area falls to a beach LIP metres above the water over RUN metres
// for each metre it stands above it, and never less than LEAST metres.
const BANK = { lip: 1 / CUBES, run: 4, least: 6 };
const LEDGE = 4;
const NORMALS = { north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0] };


/******************************************************************************/
/* GENERATE                                                                   */
/******************************************************************************/

// Runs a checked recipe over a zone, one sample every `step` columns. The
// result's `cells` hold [column, y, row, block id] for the tunnels and falls
// that columns cannot hold, and are only made at a step of 1. `clipped`
// counts the columns cut to fit under the zone's height. `bounds` holds, for
// each cliff side, how far in from the edge movement stops, metre by metre
// along the side from its west or north end. `foots` holds, for each column
// the cliffs lift, the cell of the ground they rise from, and 0 elsewhere.
export function generate(zone, recipe, { step = 1 } = {})
{
    const field = new TerrainField(zone, step, recipe.base.seed ?? 0);
    const base = Bases.BASES[recipe.base.kind];
    const cells = [];

    field.each(null, (i, x, z) => { field.heights[i] = base.height(recipe.base, x, z); });
    applyEdges(field, recipe.edges);

    const edged = field.heights.slice();

    for(const feature of recipe.features) { APPLY[feature.kind](field, feature, cells); }

    const lifts = liftsOf(field, edged);
    const grounds = groundsOf(field, lifts);
    const { surfaces, clipped } = surfacesOf(field);
    const bounds = boundsOfCliffs(field, recipe.edges);
    const foots = surfaces.map((surface, i) => (lifts[i] > 0 ? Math.max(1, surface - Math.round(lifts[i] * CUBES)) : 0));

    return { field, surfaces, grounds, cells, clipped, bounds, foots };
}

// Whether rock rather than earth shows at a point `lift` metres up a cliff.
// `u` and `v` place the point on the surface, in metres.
export function isStony(lift, u, v)
{
    const chance = smooth(GRADE.from, GRADE.to, lift);

    return chance >= 1 || clamp((Noise.fractal(SEEDS.stone, u, v, 4, 3) - 0.5) * 2.5 + 0.5) < chance;
}

// How far the cliffs lift each sample above the ground they rise from. A
// feature that cuts the cliffs down takes its cut off the lift, and a pass's
// floor is not lifted. `edged` holds the heights before the features.
function liftsOf(field, edged)
{
    return field.lift.map((lift, i) => (field.marks[i] & MARKS.pass ? 0 : Math.max(0, lift - Math.max(0, edged[i] - field.heights[i]))));
}

const APPLY =
{
    flat: applyFlat,
    basin: applyBasin,
    rise: (field, feature) => applyBox(field, feature, (h, t) => h + feature.height * t),
    hilly: applyHilly,
    hillyBand: applyHillyBand,
    river: applyRiver,
    pass: applyPass,
};


/******************************************************************************/
/* FIELD                                                                      */
/******************************************************************************/

class TerrainField
{
    constructor(zone, step, seed)
    {
        this.zone = zone;
        this.step = step;
        this.seed = seed;
        this.size = Math.ceil(zone.columns / step);
        this.spacing = step / CUBES;
        this.half = zone.columns / CUBES / 2;
        this.water = (zone.water - zone.base) / CUBES;
        this.heights = new Float32Array(this.size * this.size);
        this.lift = new Float32Array(this.size * this.size);
        this.marks = new Uint8Array(this.size * this.size);
    }

    // The sample's middle, in metres from the zone's middle.
    metres(i)
    {
        return (i * this.step + this.step / 2) / CUBES - this.half;
    }

    sampleOf(metres)
    {
        return Math.max(0, Math.min(this.size - 1, Math.floor(((metres + this.half) * CUBES) / this.step)));
    }

    indexAt(x, z)
    {
        return this.sampleOf(z) * this.size + this.sampleOf(x);
    }

    // Calls `visit(index, x, z)` for every sample inside `box`, [x0, z0, x1,
    // z1] in metres, or every sample when `box` is null.
    each(box, visit)
    {
        const [i0, j0, i1, j1] = box ? [this.sampleOf(box[0]), this.sampleOf(box[1]), this.sampleOf(box[2]), this.sampleOf(box[3])] : [0, 0, this.size - 1, this.size - 1];

        for(let j = j0; j <= j1; j++)
        {
            const z = this.metres(j);

            for(let i = i0; i <= i1; i++) { visit(j * this.size + i, this.metres(i), z); }
        }
    }

    // The surface cell of the sample at `index`, as the columns will hold it.
    surfaceAt(index)
    {
        return this.zone.base + Math.round(this.heights[index] * CUBES);
    }
}


/******************************************************************************/
/* EDGES                                                                      */
/******************************************************************************/

// Where two cliff sides meet, the higher wins. The slope at a cliff's foot
// stays out of `field.lift`, which measures the rock face alone.
function applyEdges(field, edges)
{
    field.each(null, (i, x, z) =>
    {
        const wobble = Noise.fractal(SEEDS.wobble, x, z, 70, 3) - 0.5;
        let lift = 0;
        let slope = 0;
        let sink = 0;

        for(const side of Recipe.SIDES)
        {
            const edge = edges[side];

            if(edge.kind === "none") { continue; }

            const u = clamp((edge.band - distanceToSide(side, x, z, field.half) - wobble * edge.band * 0.8) / edge.band);

            if(edge.kind === "cliffs")
            {
                lift = Math.max(lift, cliff(edge, u, x, z));
                slope = Math.max(slope, edge.foot * smooth(0, APRON.reach, u) * (APRON.least + (1 - APRON.least) * Noise.fractal(SEEDS.rough + 1, x, z, 40, 2) * 2));
            }
            else
            {
                sink = Math.max(sink, smooth(0, 0.6, u));
            }
        }

        const height = field.heights[i];

        field.heights[i] = lerp(height, Math.min(height, field.water - WATER_DEPTH), sink) + slope + lift;
        field.lift[i] = lift;
    });
}

// Movement stops at the innermost point where the cliffs lift the ground
// CLIMB metres or more, as the edges raised them: of the features, only a
// pass opens a way through.
function boundsOfCliffs(field, edges)
{
    const bounds = {};
    const metres = Math.round(field.half * 2);

    for(const side of Recipe.SIDES.filter((name) => edges[name].kind === "cliffs"))
    {
        const [nx, nz] = NORMALS[side];
        const reach = Math.min(field.half, edges[side].band * 1.5);

        bounds[side] = Array.from({ length: metres }, (unused, k) =>
        {
            const along = k + 0.5 - field.half;
            let limit = 0;

            for(let d = 0; d < reach; d += field.spacing)
            {
                const i = field.indexAt(nx * (field.half - d) + Math.abs(nz) * along, nz * (field.half - d) + Math.abs(nx) * along);

                if(!(field.marks[i] & MARKS.pass) && field.lift[i] >= CLIMB) { limit = d; }
            }

            return Math.max(ZoneData.EDGE_MARGIN, Math.ceil(limit * 2) / 2);
        });
    }

    return bounds;
}

function cliff(edge, u, x, z)
{
    const rough = 0.7 + 0.6 * Noise.fractal(SEEDS.rough, x, z, 45, 3);
    const lift = (smooth(0.15, 0.45, u) * edge.height + u * edge.height * 0.35) * rough;
    const ledges = Math.floor(lift / LEDGE);

    return (ledges + smooth(0.6, 1, lift / LEDGE - ledges)) * LEDGE;
}

function distanceToSide(side, x, z, half)
{
    const [nx, nz] = NORMALS[side];

    return half - (x * nx + z * nz);
}

function nearestSide(x, z, half)
{
    return Recipe.SIDES.reduce((best, side) => (distanceToSide(side, x, z, half) < distanceToSide(best, x, z, half) ? side : best));
}


/******************************************************************************/
/* BOXES                                                                      */
/******************************************************************************/

function applyFlat(field, feature)
{
    const height = feature.level === "water" ? field.water + feature.height : groundOf(field, feature);
    const level = Math.round(height * CUBES) / CUBES;
    const reach = Math.max(BANK.least, (level - field.water) * BANK.run);
    const shoreAt = waterDistances(field, boxOf(feature, (feature.blend ?? 0) + reach));

    applyBox(field, feature, (ground, t, x, z, i) =>
    {
        if(ground < field.water) { return ground; }

        const rolled = level + (Noise.fractal(SEEDS.roll, x, z, 40, 2) - 0.5) * 2 * feature.roll;
        const target = lerp(field.water + BANK.lip, rolled, smooth(0, reach, shoreAt(i)));

        return lerp(ground, target, t);
    });
}

// The distance in metres from each sample in `box` to the nearest sample
// under the water, by a two-pass chamfer over the box; Infinity where no
// water lies in it. The lookup takes a field index inside the box.
function waterDistances(field, box)
{
    const [i0, j0, i1, j1] = box.map((metres) => field.sampleOf(metres));
    const width = i1 - i0 + 1;
    const height = j1 - j0 + 1;
    const distances = new Float32Array(width * height).fill(Infinity);
    const near = [[-1, 0, 1], [0, -1, 1], [-1, -1, Math.SQRT2], [1, -1, Math.SQRT2]];

    for(let j = 0; j < height; j++)
    {
        for(let i = 0; i < width; i++) { if(field.heights[(j + j0) * field.size + i + i0] < field.water) { distances[j * width + i] = 0; } }
    }

    const pass = (sign) =>
    {
        for(let n = 0; n < width * height; n++)
        {
            const k = sign > 0 ? n : width * height - 1 - n;
            const [i, j] = [k % width, Math.floor(k / width)];

            for(const [di, dj, cost] of near)
            {
                const [ni, nj] = [i + di * sign, j + dj * sign];

                if(ni >= 0 && ni < width && nj >= 0 && nj < height) { distances[k] = Math.min(distances[k], distances[nj * width + ni] + cost * field.spacing); }
            }
        }
    };

    pass(1);
    pass(-1);

    return (index) => distances[(Math.floor(index / field.size) - j0) * width + (index % field.size) - i0];
}

function applyBasin(field, feature)
{
    const floor = (feature.floor === "water" ? field.water : groundOf(field, feature)) - feature.drop;

    applyBox(field, feature, (ground, t) => lerp(ground, Math.min(ground, floor), t), BASIN);
}

function applyHilly(field, area)
{
    const hills = hillsOf(field, area, boxOf(area, 0), (x, z) => boxDistance(area, x, z) <= 0);

    applyBox(field, area, hills, BASIN);
}

function applyHillyBand(field, band)
{
    const reach = band.width / 2 + band.blend;
    const hills = hillsOf(field, band, boundsOf(band.points, band.width / 2), (x, z) => nearestOnLine(band.points, x, z).distance <= band.width / 2);

    field.each(boundsOf(band.points, reach), (i, x, z) =>
    {
        const t = 1 - step(band.width / 2, reach, nearestOnLine(band.points, x, z).distance);

        if(t > 0) { field.heights[i] = hills(field.heights[i], t, x, z); }
    });
}

// Gives a shape that adds hills `height` metres from valley to top. The
// noise is centred on its own average inside the feature and scaled by its
// spread there, so any area takes both hills and valleys and keeps its
// average height where the ground stands well above the water. Ground
// already under the water stays.
function hillsOf(field, feature, box, isInside)
{
    const noiseAt = (x, z) => Noise.fractal(field.seed + SEEDS.hilly, x, z, feature.size, 4);
    let [sum, squares, count] = [0, 0, 0];

    field.each(box, (i, x, z) =>
    {
        if(!isInside(x, z)) { return; }

        const noise = noiseAt(x, z);

        sum += noise;
        squares += noise * noise;
        count++;
    });

    const mean = count > 0 ? sum / count : 0.5;
    const spread = Math.max(HILLY.least, HILLY.deviations * Math.sqrt(Math.max(0, squares / Math.max(1, count) - mean * mean)));

    return (ground, t, x, z) =>
    {
        if(ground < field.water) { return ground; }

        const added = (clamp((noiseAt(x, z) - mean) / spread + 0.5) - 0.5) * feature.height * t;
        const room = Math.max(0, ground - field.water - HILLY.clear);

        return ground + (added >= 0 || room === 0 ? Math.max(0, added) : -room * (1 - Math.exp(added / room)));
    };
}

// The average height of the dry ground inside a feature's box.
function groundOf(field, feature)
{
    let sum = 0;
    let count = 0;

    field.each(boxOf(feature, 0), (i, x, z) =>
    {
        if(boxDistance(feature, x, z) > 0 || field.heights[i] < field.water) { return; }

        sum += field.heights[i];
        count++;
    });

    return count > 0 ? sum / count : field.water;
}

// `shape(height, t, x, z, index)` gives the new height, with `t` 1 inside the box
// and falling to 0 across the blend. `round` sizes the corners, and
// `wobble` moves the outline in and out, both as a share of the box's
// shorter side.
function applyBox(field, feature, shape, { round = 0.2, wobble = 0 } = {})
{
    const blend = feature.blend ?? 0;
    const reach = Math.min(feature.width, feature.length) * wobble;

    field.each(boxOf(feature, blend + reach), (i, x, z) =>
    {
        const distance = boxDistance(feature, x, z, round) + (Noise.fractal(SEEDS.shore, x, z, 40, 3) - 0.5) * 2 * reach;
        const t = 1 - step(0, blend, distance);

        if(t > 0) { field.heights[i] = shape(field.heights[i], t, x, z, i); }
    });
}

function boxOf(feature, margin)
{
    return [feature.x - feature.width / 2 - margin, feature.z - feature.length / 2 - margin, feature.x + feature.width / 2 + margin, feature.z + feature.length / 2 + margin];
}

// The signed distance from a box with rounded corners: negative inside.
function boxDistance(feature, x, z, round = 0.2)
{
    const radius = Math.min(feature.width, feature.length) * round;
    const qx = Math.abs(x - feature.x) - (feature.width / 2 - radius);
    const qz = Math.abs(z - feature.z) - (feature.length / 2 - radius);

    return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - radius;
}


/******************************************************************************/
/* RIVERS                                                                     */
/******************************************************************************/

// `first` and `last` bound the open stretch: from where the start leaves the
// cliffs to where the end meets them.
function applyRiver(field, river, cells)
{
    const { path, corners } = densify(river.points);
    const isOpen = (point) => field.lift[field.indexAt(...point)] < FOOT;
    const first = river.start === "waterfall" ? path.findIndex(isOpen) : 0;
    const last = river.end === "none" ? path.length - 1 : path.findLastIndex(isOpen);

    if(first < 0 || last < first) { return; }

    const open = [path[first], ...corners.filter((k) => k > first && k < last).map((k) => path[k]), path[last]];
    const isFed = river.start === "waterfall" && first > 0;

    carve(field, open, river.width, river.valley, { isWobbly: true, isCut: [isFed, river.end !== "none"] });

    if(isFed)
    {
        const pool = path[Math.min(last, first + Math.round(river.width / 2 + POOL))];

        carve(field, [pool, pool], river.width + POOL * 2, river.valley / 2);
        fall(field, path.slice(0, first + 1).reverse(), cells);
    }

    if(river.end === "none") { return; }

    const inward = river.end === "gorge" ? gorge(field, path, last) : approach(field, path, last);

    if(!inward) { return; }

    carve(field, inward, river.width, GORGE.valley, { isCut: [false, true] });
    tunnel(field, inward.at(-1), direction(inward.at(-2), inward.at(-1)), river.width, cells);
}

// The river follows its own points, then runs straight on, into the cliff
// until the rock is high enough for an arch; null when no cliff is near.
function approach(field, path, last)
{
    const line = [path[last]];
    let heading = direction(path[Math.max(0, last - 5)], path[last]);

    for(let k = last + 1; k < path.length + ARCH.length * 3; k++)
    {
        const [x, z] = line.at(-1);
        const next = k < path.length ? path[k] : [x + heading[0], z + heading[1]];

        heading = direction([x, z], next);
        line.push(next);

        if(field.lift[field.indexAt(...next)] >= MOUTH) { return line; }
    }

    return null;
}

// The gorge cuts straight in, then turns along the edge towards the side's
// middle.
function gorge(field, path, last)
{
    const start = path[last];
    const side = nearestSide(...start, field.half);
    const band = Math.max(FOOT, distanceToSide(side, ...start, field.half));
    const heading = direction(path[Math.max(0, last - 5)], start);
    const bend = [start[0] + heading[0] * band * GORGE.inward, start[1] + heading[1] * band * GORGE.inward];
    const across = [-heading[1], heading[0]];
    const sign = across[0] * bend[0] + across[1] * bend[1] > 0 ? -1 : 1;

    return [start, bend, [bend[0] + across[0] * sign * GORGE.along, bend[1] + across[1] * sign * GORGE.along]];
}

// Cuts a channel to the river bed along `line`, with banks that rise to the
// ground over `valley` metres. Each end is round unless `isCut` cuts it
// square, as where the river meets a cliff.
function carve(field, line, width, valley, { isWobbly = false, isCut = [false, false] } = {})
{
    const reach = width * (isWobbly ? RIVER.widest : 1) / 2 + valley;
    const bed = field.water - BED;
    const length = lengthOf(line);

    field.each(boundsOf(line, reach + 2), (i, x, z) =>
    {
        const wobble = isWobbly ? (Noise.fractal(SEEDS.river, x, z, 30, 2) - 0.5) * 4 : 0;
        const { distance, along } = nearestOnLine(line, x, z);
        const half = (isWobbly ? widthAt(width, along, length) : width) / 2;
        const d = distance + wobble;
        const isPastEnd = (isCut[0] && along <= 0) || (isCut[1] && along >= length);

        if(d > half + valley || (isPastEnd && distance > 0)) { return; }

        field.heights[i] = Math.min(field.heights[i], lerp(bed, field.heights[i], smooth(half, half + valley, d)));

        if(d < half + 1.5) { field.marks[i] |= MARKS.bank; }
    });
}

// A river's width wanders from RIVER.narrowest to RIVER.widest of its set
// width along its course, and returns to the set width over RIVER.ends
// metres at each end, where it meets a fall, a pool or a tunnel.
function widthAt(width, along, length)
{
    const wander = clamp((Noise.fractal(SEEDS.river + 1, along, 0, RIVER.wander, 2) - 0.5) * 2.5 + 0.5);
    const share = RIVER.narrowest + (RIVER.widest - RIVER.narrowest) * wander;

    return width * lerp(1, share, smooth(0, RIVER.ends, Math.min(along, length - along)));
}

function tunnel(field, start, heading, width, cells)
{
    if(field.step !== 1) { return; }

    const zone = field.zone;
    const end = [start[0] + heading[0] * ARCH.length, start[1] + heading[1] * ARCH.length];
    const bedCell = zone.base + Math.round((field.water - BED) * CUBES);

    field.each(boundsOf([start, end], width / 2 + 1), (i, x, z) =>
    {
        const along = (x - start[0]) * heading[0] + (z - start[1]) * heading[1];
        const aside = Math.abs((x - start[0]) * heading[1] - (z - start[1]) * heading[0]) / (width / 2);

        if(along < 0 || along > ARCH.length || aside > 1) { return; }

        const roof = Math.round(ARCH.height * (1 - along / ARCH.length) * Math.sqrt(1 - aside * aside) * CUBES);
        const top = field.surfaceAt(i);
        const [column, row] = [i % field.size, Math.floor(i / field.size)];

        for(let y = bedCell; y < Math.min(top, zone.water); y++) { cells.push([column, y, row, "water"]); }
        for(let y = zone.water; y < Math.min(top, zone.water + roof); y++) { cells.push([column, y, row, "air"]); }
    });
}

// `line` runs from the pool up the cliff.
function fall(field, line, cells)
{
    const peak = Math.max(...line.map((point) => field.lift[field.indexAt(...point)]));
    const topIndex = line.findIndex((point) => field.lift[field.indexAt(...point)] >= peak * FALL.top);
    const top = line[Math.max(1, topIndex)];
    const heading = direction(line[0], top);
    const back = [top[0] + heading[0] * FALL.notch, top[1] + heading[1] * FALL.notch];
    const floor = field.heights[field.indexAt(...top)];
    const notch = [top, back];

    field.each(boundsOf(notch, FALL.notchWidth / 2 + 1), (i, x, z) =>
    {
        if(nearestOnLine(notch, x, z).distance <= FALL.notchWidth / 2) { field.heights[i] = Math.min(field.heights[i], floor); }
    });

    const face = [line[0], top, back];

    field.each(boundsOf(face, FALL.width / 2 + 1), (i, x, z) =>
    {
        if(nearestOnLine(face, x, z).distance > FALL.width / 2) { return; }

        field.marks[i] |= MARKS.fall;

        if(field.step === 1) { pour(field, i, cells); }
    });
}

function pour(field, i, cells)
{
    const { size } = field;
    const [column, row] = [i % size, Math.floor(i / size)];
    const top = field.surfaceAt(i);
    const neighbours = [column > 0 ? i - 1 : i, column < size - 1 ? i + 1 : i, row > 0 ? i - size : i, row < size - 1 ? i + size : i];
    const lowest = Math.min(...neighbours.map((n) => field.surfaceAt(n)));

    for(let y = Math.max(top - FALL.step, Math.min(top - 1, lowest)); y < top; y++) { cells.push([column, y, row, "water"]); }
}


/******************************************************************************/
/* PASSES                                                                     */
/******************************************************************************/

// The line runs from the pass's middle towards the nearest edge, jogs
// sideways along it, then runs out past the edge.
// The pass starts where the cliffs stop lifting the ground, inward of its
// point when the point lies on them, and runs straight out to the edge.
function applyPass(field, pass)
{
    const side = nearestSide(pass.x, pass.z, field.half);
    const [nx, nz] = NORMALS[side];
    const start = [pass.x, pass.z];

    while(field.lift[field.indexAt(...start)] > 0 && distanceToSide(side, ...start, field.half) < field.half) { [start[0], start[1]] = [start[0] - nx, start[1] - nz]; }

    const length = distanceToSide(side, ...start, field.half) + 2;
    const line = [start, [start[0] + nx * length, start[1] + nz * length]];
    const floor = field.heights[field.indexAt(...start)];

    field.each(boundsOf(line, pass.width / 2 + PASS.banks + 1), (i, x, z) =>
    {
        const { distance, along } = nearestOnLine(line, x, z);
        const level = floor + PASS.rise * along / length;

        if(distance > pass.width / 2 + PASS.banks) { return; }

        field.heights[i] = Math.min(field.heights[i], lerp(level, field.heights[i], smooth(pass.width / 2, pass.width / 2 + PASS.banks, distance)));

        if(distance < pass.width / 2) { field.marks[i] |= MARKS.pass; }
    });
}


/******************************************************************************/
/* GROUND AND COLUMNS                                                         */
/******************************************************************************/

function groundsOf(field, lifts)
{
    const { size, heights, spacing } = field;
    const grounds = new Uint8Array(size * size);

    field.each(null, (i, x, z) =>
    {
        const [column, row] = [i % size, Math.floor(i / size)];
        const height = heights[i];
        const neighbours = [column > 0 ? i - 1 : i, column < size - 1 ? i + 1 : i, row > 0 ? i - size : i, row < size - 1 ? i + size : i];
        const slope = Math.max(...neighbours.map((n) => Math.abs(heights[n] - height))) / spacing;
        const damp = Noise.fractal(SEEDS.damp, x, z, 30, 2);

        if(lifts[i] > 0 ? isStony(lifts[i], x, z) : slope >= ROCK_SLOPE) { grounds[i] = ROCK; }
        else if(field.marks[i] & (MARKS.bank | MARKS.pass)) { grounds[i] = MUD; }
        else if(height <= field.water + SHORE) { grounds[i] = SAND; }
        else if(damp > 0.72) { grounds[i] = MUD; }
        else if(damp > 0.55) { grounds[i] = MOSS; }
        else { grounds[i] = GRASS; }
    });

    return grounds;
}

function surfacesOf(field)
{
    const surfaces = new Uint16Array(field.size * field.size);
    const highest = field.zone.height - 1;
    let clipped = 0;

    for(let i = 0; i < surfaces.length; i++)
    {
        const surface = field.surfaceAt(i);

        if(surface > highest || surface < 1) { clipped++; }

        surfaces[i] = Math.max(1, Math.min(highest, surface));
    }

    return { surfaces, clipped };
}


/******************************************************************************/
/* GEOMETRY                                                                   */
/******************************************************************************/

// The line's points about a metre apart, and the place in `path` of each of
// the line's own points.
function densify(points)
{
    const path = [points[0]];
    const corners = [0];

    for(let k = 1; k < points.length; k++)
    {
        const [ax, az] = points[k - 1];
        const [bx, bz] = points[k];
        const count = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az)));

        for(let s = 1; s <= count; s++) { path.push([lerp(ax, bx, s / count), lerp(az, bz, s / count)]); }

        corners.push(path.length - 1);
    }

    return { path, corners };
}

// The distance from the point to the line, and how far along the line its
// nearest point lies.
function nearestOnLine(line, x, z)
{
    let best = { distance: Infinity, along: 0 };
    let travelled = 0;

    for(let k = 0; k < line.length - 1; k++)
    {
        const [ax, az] = line[k];
        const [bx, bz] = line[k + 1];
        const length = Math.hypot(bx - ax, bz - az);
        const t = length === 0 ? 0 : clamp(((x - ax) * (bx - ax) + (z - az) * (bz - az)) / (length * length));
        const distance = Math.hypot(x - ax - t * (bx - ax), z - az - t * (bz - az));

        if(distance < best.distance) { best = { distance, along: travelled + t * length }; }

        travelled += length;
    }

    return best;
}

function lengthOf(line)
{
    return line.slice(1).reduce((sum, [x, z], k) => sum + Math.hypot(x - line[k][0], z - line[k][1]), 0);
}

function boundsOf(line, margin)
{
    const xs = line.map(([x]) => x);
    const zs = line.map(([, z]) => z);

    return [Math.min(...xs) - margin, Math.min(...zs) - margin, Math.max(...xs) + margin, Math.max(...zs) + margin];
}

function direction([ax, az], [bx, bz])
{
    const length = Math.hypot(bx - ax, bz - az) || 1;

    return [(bx - ax) / length, (bz - az) / length];
}

function clamp(value)
{
    return Math.min(1, Math.max(0, value));
}

function lerp(a, b, t)
{
    return a + (b - a) * t;
}

function smooth(low, high, value)
{
    const t = clamp((value - low) / (high - low));

    return t * t * (3 - 2 * t);
}

// A smooth step that becomes a hard edge when the range closes.
function step(low, high, value)
{
    return high > low ? smooth(low, high, value) : (value > low ? 1 : 0);
}
