import * as RegionCodec from "../sim/region-codec.js";
import { ZoneData } from "../sim/zone-data.js";

const { CHUNK } = RegionCodec;
const MARGIN = 15;
const PADDED = CHUNK + MARGIN * 2;
const BEDROCK = 255;
const MAX_LIGHT = 15;
const SHADES = [1, 0.84, 0.72, 0.6];
const CORNERS = [[0, 0], [1, 0], [1, 1], [0, 1]];
const WEATHERS = { moss: 1, grime: 2, cracks: 4, chips: 8 };
const OVERLAYS = ["mossTop", "mossEdge", "mossFoot", "grime", "cracks"];
const OVERLAY_STRENGTH = 1.3;
const LEVELS = 3;
const UP = PADDED * PADDED;
const FINE = 8;
const MAX_CHIPS = 48;
const NOTCH_SHADE = 0.8;
const COARSE = ZoneData.COARSE;
const GLOW_REACH = CHUNK;
const COARSE_SIDE = (CHUNK + GLOW_REACH * 2) / COARSE;
const COARSE_SPAN = CHUNK / COARSE;
const GLOW_KEEP = 0.82;
const GLOW_END = 0.05;
const GLOW_BANDS = 15;
const HUE_STEPS = 15;
const HUE_SHIFT = 65536;
const GLOW_STEPS = Math.log(GLOW_END) / Math.log(GLOW_KEEP);
const FILL_STEPS = 6;
const FILL_KEEP = Math.sqrt(GLOW_KEEP);
const CORE = [GLOW_REACH / COARSE - 1 - Math.ceil((FILL_STEPS + 1) / COARSE), (GLOW_REACH + CHUNK) / COARSE + Math.ceil((FILL_STEPS + 1) / COARSE)];

// The step through the padded cells along x, y and z.
const STRIDES = [1, PADDED * PADDED, PADDED];

// Texture coordinates come from a corner's cell position.
const DIRECTIONS =
[
    { axis: 0, sign: 1, u: 2, v: 1, side: "side", uv: ([, y, z]) => [-z, y] },
    { axis: 0, sign: -1, u: 2, v: 1, side: "side", uv: ([, y, z]) => [z, y] },
    { axis: 1, sign: 1, u: 0, v: 2, side: "top", uv: ([x, , z]) => [x, -z] },
    { axis: 1, sign: -1, u: 0, v: 2, side: "bottom", uv: ([x, , z]) => [x, z] },
    { axis: 2, sign: 1, u: 0, v: 1, side: "side", uv: ([x, y]) => [x, y] },
    { axis: 2, sign: -1, u: 0, v: 1, side: "side", uv: ([x, y]) => [-x, y] },
];

export const PADDING = MARGIN;


/******************************************************************************/
/* FACE TABLE                                                                 */
/******************************************************************************/

export function faceTable(blocks, atlas)
{
    const count = blocks.count + 1;
    const flags = () => new Uint8Array(256);
    const table = { top: new Int16Array(count), side: new Int16Array(count), bottom: new Int16Array(count), opaque: flags(), clear: flags(), glass: flags(), liquid: flags(), hidden: flags(), standable: flags(), lights: flags() };

    table.weathers = flags();
    table.glowKeys = new Int32Array(256);
    table.worn = new Int16Array(256).fill(-1);
    table.overlays = Object.fromEntries(OVERLAYS.map((name) => [name, atlas.names.indexOf(name)]));

    for(let number = 1; number < count; number++)
    {
        const block = blocks.block(number);

        for(const side of ["top", "side", "bottom"]) { table[side][number] = block.faces[side] ? atlas.layer(block.faces[side]) : 0; }

        table.opaque[number] = block.kind === "solid" ? 1 : 0;
        table.clear[number] = block.kind === "clear" ? 1 : 0;
        table.glass[number] = block.kind === "glass" ? 1 : 0;
        table.liquid[number] = block.kind === "liquid" ? 1 : 0;
        table.hidden[number] = block.kind === "liquid" || block.kind === "object" ? 1 : 0;
        table.standable[number] = block.kind === "solid" || block.kind === "clear" || block.kind === "glass" || block.kind === "object" ? 1 : 0;
        table.lights[number] = block.light;
        table.glowKeys[number] = block.light > 0 ? blocks.glowKey(number) : 0;
        table.weathers[number] = (block.weathers ?? []).reduce((bits, weather) => bits | WEATHERS[weather], 0);
        table.worn[number] = block.worn ? atlas.layer(block.worn) : -1;
    }

    table.frameLayer = atlas.frameLayer;

    table.opaque[BEDROCK] = 1;

    return table;
}


/******************************************************************************/
/* CELLS                                                                      */
/******************************************************************************/

// The chunk's cells with a border of MARGIN cells from its neighbours, in
// (y * PADDED + z) * PADDED + x order, the surface and the weathering age
// of each padded column, and the coarse cells of the chunk and its 26
// neighbours for the glow; see coarseVolume.
// Cells below the zone, and in regions not loaded, count as solid.
export function paddedCells(zone, cx, cy, cz)
{
    const cells = new Uint8Array(PADDED * PADDED * PADDED);
    const surfaces = new Uint16Array(PADDED * PADDED);
    const ages = new Uint8Array(PADDED * PADDED);
    const left = cx * CHUNK - MARGIN;
    const bottom = cy * CHUNK - MARGIN;
    const back = cz * CHUNK - MARGIN;

    for(let dy = -1; dy <= 1; dy++)
    {
        for(let dz = -1; dz <= 1; dz++)
        {
            for(let dx = -1; dx <= 1; dx++) { copyChunk(zone, cells, [cx + dx, cy + dy, cz + dz], [left, bottom, back]); }
        }
    }

    for(let z = 0; z < PADDED; z++)
    {
        for(let x = 0; x < PADDED; x++)
        {
            surfaces[z * PADDED + x] = zone.surface(left + x, back + z);
            ages[z * PADDED + x] = zone.age(left + x, back + z);
        }
    }

    return { cells, surfaces, ages, bottom, coarse: coarseVolume(zone, cx, cy, cz) };
}

function copyChunk(zone, cells, [cx, cy, cz], [left, bottom, back])
{
    const isOutside = cx < 0 || cz < 0 || cx >= zone.chunksWide || cz >= zone.chunksWide;
    const isUnknown = cy < 0 || (!isOutside && !zone.isColumnLoaded(cx * CHUNK, cz * CHUNK));
    const chunk = isOutside || isUnknown ? null : zone.chunkAt(cx, cy, cz);
    const low = [cx * CHUNK, cy * CHUNK, cz * CHUNK].map((start, axis) => Math.max(start, [left, bottom, back][axis]));
    const high = [cx * CHUNK, cy * CHUNK, cz * CHUNK].map((start, axis) => Math.min(start + CHUNK, [left, bottom, back][axis] + PADDED));

    if(low.some((value, axis) => value >= high[axis])) { return; }

    for(let y = low[1]; y < high[1]; y++)
    {
        for(let z = low[2]; z < high[2]; z++)
        {
            const to = ((y - bottom) * PADDED + (z - back)) * PADDED - left;

            for(let x = low[0]; x < high[0]; x++)
            {
                let block = 0;

                if(isUnknown) { block = BEDROCK; }
                else if(chunk) { block = chunk.cells === null ? chunk.uniform : chunk.cells[((y - cy * CHUNK) * CHUNK + (z - cz * CHUNK)) * CHUNK + (x - cx * CHUNK)]; }

                cells[to + x] = block;
            }
        }
    }
}

// The coarse cells of the chunk and its 26 neighbours, COARSE_SIDE a side in
// (y * COARSE_SIDE + z) * COARSE_SIDE + x order: `open` and `lights` as
// ZoneData.coarseOf gives them, with each light's index into this volume. A
// neighbour outside the zone or not loaded is closed. Null when no light lies
// in the volume, as no glow can then reach the chunk. `lights` holds
// [index, strength, colour] with the lights of one colour together, the
// brightest first, and those of one colour in one coarse cell joined.
export function coarseVolume(zone, cx, cy, cz)
{
    const neighbours = [];

    for(let dy = -1; dy <= 1; dy++)
    {
        for(let dz = -1; dz <= 1; dz++)
        {
            for(let dx = -1; dx <= 1; dx++) { neighbours.push([[dx + 1, dy + 1, dz + 1].map((value) => value * COARSE_SPAN), zone.coarseOf?.(cx + dx, cy + dy, cz + dz) ?? null]); }
        }
    }

    if(!neighbours.some(([, coarse]) => coarse?.lights.length > 0)) { return null; }

    const open = new Uint8Array(COARSE_SIDE ** 3);
    const merged = new Map();

    for(const [[ox, oy, oz], coarse] of neighbours.filter(([, entry]) => entry))
    {
        for(let y = 0; y < COARSE_SPAN; y++)
        {
            for(let z = 0; z < COARSE_SPAN; z++)
            {
                const from = (y * COARSE_SPAN + z) * COARSE_SPAN;

                open.set(coarse.open.subarray(from, from + COARSE_SPAN), ((oy + y) * COARSE_SIDE + oz + z) * COARSE_SIDE + ox);
            }
        }

        for(let i = 0; i < coarse.lights.length; i += 5)
        {
            const [x, y, z] = [coarse.lights[i] - (cx - 1) * COARSE_SPAN, coarse.lights[i + 1] - (cy - 1) * COARSE_SPAN, coarse.lights[i + 2] - (cz - 1) * COARSE_SPAN];

            if(x < 0 || y < 0 || z < 0 || x >= COARSE_SIDE || y >= COARSE_SIDE || z >= COARSE_SIDE) { continue; }

            const key = ((y * COARSE_SIDE + z) * COARSE_SIDE + x) + ":" + coarse.lights[i + 4];

            merged.set(key, Math.max(merged.get(key) ?? 0, coarse.lights[i + 3]));
        }
    }

    const lights = [...merged].map(([key, strength]) => [...key.split(":").map(Number), strength]).sort((a, b) => a[1] - b[1] || b[2] - a[2]);

    return { open, lights: Float64Array.from(lights.flatMap(([at, colour, strength]) => [at, strength, colour])) };
}


/******************************************************************************/
/* LIGHT                                                                      */
/******************************************************************************/

// Each cell's sky light in the high four bits and lamp light in the low four.
// Sky light is MAX_LIGHT above a column's surface; both spread through cells
// that are not opaque, one level dimmer a cell.
export function lightCells(volume, table)
{
    return lightField(volume, table).light;
}

// The light of lightCells, and `hueOf(index)`: the colour of the lamp light
// in a cell, as red * 256 + green * 16 + blue with each from 0 to HUE_STEPS,
// or 0 where no lamp light reaches. The lamps of each colour spread on their
// own, and a cell's colour is theirs mixed by the square of each colour's
// level there, so the nearest lamp's colour leads.
function lightField(volume, table)
{
    const { cells, surfaces, bottom } = volume;
    const sky = new Uint8Array(cells.length);
    const skySeeds = [];
    const seedsOf = new Map();

    for(let z = 0; z < PADDED; z++)
    {
        for(let x = 0; x < PADDED; x++)
        {
            const open = Math.max(0, surfaces[z * PADDED + x] - bottom);

            for(let y = open; y < PADDED; y++) { sky[(y * PADDED + z) * PADDED + x] = MAX_LIGHT; }

            for(const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
            {
                const nx = x + dx;
                const nz = z + dz;

                if(nx < 0 || nz < 0 || nx >= PADDED || nz >= PADDED) { continue; }

                const covered = Math.min(PADDED, surfaces[nz * PADDED + nx] - bottom);

                for(let y = open; y < covered; y++) { skySeeds.push((y * PADDED + z) * PADDED + x); }
            }
        }
    }

    for(let i = 0; i < cells.length; i++)
    {
        if(table.lights[cells[i]] === 0) { continue; }

        const colour = table.glowKeys?.[cells[i]] ?? 0;

        if(!seedsOf.has(colour)) { seedsOf.set(colour, []); }

        seedsOf.get(colour).push(i);
    }

    spread(sky, skySeeds, cells, table.opaque);

    const lamps = [...seedsOf].map(([colour, seeds]) =>
    {
        const levels = new Uint8Array(cells.length);

        for(const seed of seeds) { levels[seed] = table.lights[cells[seed]]; }

        spread(levels, seeds, cells, table.opaque);

        return { colour, levels };
    });
    const light = new Uint8Array(cells.length);

    for(let i = 0; i < light.length; i++) { light[i] = sky[i] << 4; }

    for(const lamp of lamps)
    {
        const levels = lamp.levels;

        for(let i = 0; i < light.length; i++) { if(levels[i] > (light[i] & 0xf)) { light[i] = (light[i] & 0xf0) | levels[i]; } }
    }

    if(lamps.length === 1)
    {
        const hue = hueCode(lamps[0].colour >> 16, (lamps[0].colour >> 8) & 0xff, lamps[0].colour & 0xff);

        return { light, hueOf: (index) => ((light[index] & 0xf) > 0 ? hue : 0) };
    }

    return { light, hueOf: (index) => lampHue(lamps, index) };
}

function lampHue(lamps, index)
{
    let r = 0;
    let g = 0;
    let b = 0;

    for(let i = 0; i < lamps.length; i++)
    {
        const level = lamps[i].levels[index];

        if(level === 0) { continue; }

        const colour = lamps[i].colour;
        const weight = level * level;

        r += (colour >> 16) * weight;
        g += ((colour >> 8) & 0xff) * weight;
        b += (colour & 0xff) * weight;
    }

    return hueCode(r, g, b);
}

// A colour at full strength as red * 256 + green * 16 + blue, each from 0 to
// HUE_STEPS, or 0 for black.
function hueCode(r, g, b)
{
    const strongest = Math.max(r, g, b);

    return strongest === 0 ? 0 : Math.round((r / strongest) * HUE_STEPS) * 256 + Math.round((g / strongest) * HUE_STEPS) * 16 + Math.round((b / strongest) * HUE_STEPS);
}

/* GLOW ***********************************************************************/

// Buffers kept between chunks, as each chunk's glow needs them afresh, and
// each coarse cell's distance in steps from the chunk's own coarse cells and
// the ring around them, which are all the mesher reads.
const glowBuffers = { glow: null, level: null, queue: new Int32Array(1 << 16), strengths: new Float32Array(1 << 16), toCore: null, coarseOf: null, fine: null, steps: null, fill: null };

function toCore()
{
    if(glowBuffers.toCore) { return glowBuffers.toCore; }

    const distances = new Uint8Array(COARSE_SIDE ** 3);
    const away = (value) => Math.max(0, CORE[0] - value, value - CORE[1]);

    for(let y = 0; y < COARSE_SIDE; y++)
    {
        for(let z = 0; z < COARSE_SIDE; z++)
        {
            for(let x = 0; x < COARSE_SIDE; x++) { distances[(y * COARSE_SIDE + z) * COARSE_SIDE + x] = Math.min(255, away(x) + away(y) + away(z)); }
        }
    }

    glowBuffers.toCore = distances;

    return distances;
}

// The red, green and blue glow of each coarse cell. The lights of each colour
// spread together through open coarse cells, as one strength that keeps
// GLOW_KEEP of itself a step, and the colours then add, each at its strength:
// so a glow keeps its colour as it fades, and two colours mix by degrees where
// they meet. A spread stops where it could no longer reach the chunk before
// it fades out, so cells far from the chunk may stay dark. Each queued entry
// is its cell and the steps it has left, packed as cell * 32 + steps.
export function glowCells({ open, lights })
{
    glowBuffers.glow ??= new Float32Array(COARSE_SIDE ** 3 * 3);
    glowBuffers.level ??= new Float32Array(COARSE_SIDE ** 3);

    const glow = glowBuffers.glow.fill(0);
    const { level } = glowBuffers;
    const distances = toCore();
    const layer = COARSE_SIDE * COARSE_SIDE;
    let { queue, strengths } = glowBuffers;
    let tail = 0;

    const take = (index, strength, left) =>
    {
        if(distances[index] > left || strength <= level[index]) { return; }

        level[index] = strength;

        if(tail === queue.length)
        {
            const grownQueue = new Int32Array(queue.length * 2);
            const grownStrengths = new Float32Array(strengths.length * 2);

            grownQueue.set(queue);
            grownStrengths.set(strengths);
            queue = grownQueue;
            strengths = grownStrengths;
            glowBuffers.queue = queue;
            glowBuffers.strengths = strengths;
        }

        queue[tail] = index * 32 + left;
        strengths[tail] = strength;
        tail++;
    };

    for(let first = 0; first < lights.length;)
    {
        const colour = lights[first + 2];
        let last = first;

        level.fill(0);
        tail = 0;

        for(; last < lights.length && lights[last + 2] === colour; last += 3)
        {
            const strength = lights[last + 1];

            if(strength >= GLOW_END) { take(lights[last], strength, Math.floor(Math.log(GLOW_END / strength) / Math.log(GLOW_KEEP))); }
        }

        for(let head = 0; head < tail; head++)
        {
            const left = queue[head] % 32 - 1;

            if(left < 0) { continue; }

            const index = Math.floor(queue[head] / 32);
            const strength = strengths[head] * GLOW_KEEP;
            const x = index % COARSE_SIDE;
            const z = Math.floor(index / COARSE_SIDE) % COARSE_SIDE;
            const y = Math.floor(index / layer);

            if(x > 0 && open[index - 1]) { take(index - 1, strength, left); }
            if(x < COARSE_SIDE - 1 && open[index + 1]) { take(index + 1, strength, left); }
            if(z > 0 && open[index - COARSE_SIDE]) { take(index - COARSE_SIDE, strength, left); }
            if(z < COARSE_SIDE - 1 && open[index + COARSE_SIDE]) { take(index + COARSE_SIDE, strength, left); }
            if(y > 0 && open[index - layer]) { take(index - layer, strength, left); }
            if(y < COARSE_SIDE - 1 && open[index + layer]) { take(index + layer, strength, left); }
        }

        const [r, g, b] = [Math.floor(colour / 65536) / 255, Math.floor(colour / 256) % 256 / 255, colour % 256 / 255];

        for(let i = 0; i < level.length; i++)
        {
            if(level[i] === 0) { continue; }

            glow[i * 3] += r * level[i];
            glow[i * 3 + 1] += g * level[i];
            glow[i * 3 + 2] += b * level[i];
        }

        first = last;
    }

    return glow;
}

// A glow packed as band * 4096 + red * 256 + green * 16 + blue: each channel,
// 0 to HUE_STEPS, is its colour at full strength, and the band, 1 to
// GLOW_BANDS, its strength. The band falls with the square of the distance
// from the light as a share of the glow's reach, so it stays high through a
// room and falls away towards the end of its reach, as the light that a
// room's walls bounce does. 0 is no glow.
function glowCode(r, g, b)
{
    const strongest = Math.max(r, g, b);

    if(strongest < GLOW_END) { return 0; }

    const reach = Math.log(Math.min(1, strongest)) / Math.log(GLOW_KEEP) / GLOW_STEPS;
    const band = Math.max(1, Math.round(GLOW_BANDS * (1 - reach * reach)));

    return band * 4096 + Math.round((r / strongest) * HUE_STEPS) * 256 + Math.round((g / strongest) * HUE_STEPS) * 16 + Math.round((b / strongest) * HUE_STEPS);
}

// Each padded cell's coarse cell in the coarse volume.
function coarseIndices()
{
    if(glowBuffers.coarseOf) { return glowBuffers.coarseOf; }

    const indices = new Int32Array(PADDED ** 3);
    const coarse = (value) => Math.floor((value - MARGIN + GLOW_REACH) / COARSE);

    for(let y = 0; y < PADDED; y++)
    {
        for(let z = 0; z < PADDED; z++)
        {
            for(let x = 0; x < PADDED; x++) { indices[(y * PADDED + z) * PADDED + x] = (coarse(y) * COARSE_SIDE + coarse(z)) * COARSE_SIDE + coarse(x); }
        }
    }

    glowBuffers.coarseOf = indices;

    return indices;
}

// The glow of each padded cell, as a function of its index. A cell in an open
// coarse cell takes that cell's glow. A cell in a closed one, beside a wall,
// in a corner or in a recess a cube wide, takes the glow that reaches it
// through open cells from the nearest open coarse cell, up to FILL_STEPS
// cells away, fading as the glow does; a wall's far side is not reached,
// as no open cell leads to it.
function fineGlow(volume, table)
{
    const { cells } = volume;
    const { open } = volume.coarse;
    const glow = glowCells(volume.coarse);
    const coarseOf = coarseIndices();
    const opaque = table.opaque;
    const size = PADDED ** 3;

    glowBuffers.fine ??= new Float32Array(size * 3);
    glowBuffers.steps ??= new Uint8Array(size);
    glowBuffers.fill ??= new Int32Array(size);

    const { fine, fill } = glowBuffers;
    const steps = glowBuffers.steps.fill(0);
    const low = Math.max(1, MARGIN - FILL_STEPS - 1);
    const high = Math.min(PADDED - 1, MARGIN + CHUNK + FILL_STEPS + 1);
    const around = [1, -1, PADDED, -PADDED, UP, -UP];
    let tail = 0;

    for(let y = low; y < high; y++)
    {
        for(let z = low; z < high; z++)
        {
            for(let x = low; x < high; x++)
            {
                const index = (y * PADDED + z) * PADDED + x;

                if(opaque[cells[index]] === 1 || open[coarseOf[index]] === 1) { continue; }

                let best = -1;
                let strongest = GLOW_END;

                for(const step of around)
                {
                    const from = coarseOf[index + step];

                    if(opaque[cells[index + step]] === 1 || open[from] !== 1) { continue; }

                    const strength = Math.max(glow[from * 3], glow[from * 3 + 1], glow[from * 3 + 2]);

                    if(strength > strongest)
                    {
                        best = from;
                        strongest = strength;
                    }
                }

                if(best < 0) { continue; }

                for(let channel = 0; channel < 3; channel++) { fine[index * 3 + channel] = glow[best * 3 + channel] * FILL_KEEP; }

                steps[index] = 1;
                fill[tail++] = index;
            }
        }
    }

    for(let head = 0; head < tail; head++)
    {
        const index = fill[head];

        if(steps[index] >= FILL_STEPS) { continue; }

        for(const step of around)
        {
            const next = index + step;
            const [x, y, z] = [next % PADDED, Math.floor(next / UP), Math.floor(next / PADDED) % PADDED];
            const isInside = x >= low && x < high && y >= low && y < high && z >= low && z < high;

            if(!isInside || steps[next] !== 0 || opaque[cells[next]] === 1 || open[coarseOf[next]] === 1) { continue; }

            for(let channel = 0; channel < 3; channel++) { fine[next * 3 + channel] = fine[index * 3 + channel] * FILL_KEEP; }

            steps[next] = steps[index] + 1;
            fill[tail++] = next;
        }
    }

    return (index) =>
    {
        const coarse = coarseOf[index];

        if(open[coarse] === 1) { return glowCode(glow[coarse * 3], glow[coarse * 3 + 1], glow[coarse * 3 + 2]); }

        return steps[index] === 0 ? 0 : glowCode(fine[index * 3], fine[index * 3 + 1], fine[index * 3 + 2]);
    };
}

// Breadth first, so each cell keeps the brightest level that reaches it.
function spread(levels, seeds, cells, opaque)
{
    let queue = new Int32Array(Math.max(1024, seeds.length * 2));
    let head = 0;
    let tail = seeds.length;

    queue.set(seeds);

    const visit = (neighbour, next) =>
    {
        if(opaque[cells[neighbour]] === 1 || levels[neighbour] >= next) { return; }

        levels[neighbour] = next;

        if(tail === queue.length)
        {
            const grown = new Int32Array(queue.length * 2);

            grown.set(queue);
            queue = grown;
        }

        queue[tail++] = neighbour;
    };

    while(head < tail)
    {
        const index = queue[head++];
        const next = levels[index] - 1;

        if(next <= 0) { continue; }

        const x = index % PADDED;
        const z = Math.floor(index / PADDED) % PADDED;
        const y = Math.floor(index / (PADDED * PADDED));

        if(x > 0) { visit(index - 1, next); }
        if(x < PADDED - 1) { visit(index + 1, next); }
        if(z > 0) { visit(index - PADDED, next); }
        if(z < PADDED - 1) { visit(index + PADDED, next); }
        if(y > 0) { visit(index - PADDED * PADDED, next); }
        if(y < PADDED - 1) { visit(index + PADDED * PADDED, next); }
    }
}


/******************************************************************************/
/* MESH                                                                       */
/******************************************************************************/

// Liquids are left to the water view.
export function buildChunk(zone, table, atlas, cx, cy, cz)
{
    const frame = { half: zone.half, base: zone.base, perCell: atlas.uvPerMetre / ZoneData.CUBES_PER_METRE };

    return meshCells(paddedCells(zone, cx, cy, cz), table, [cx * CHUNK, cy * CHUNK, cz * CHUNK], frame);
}

// The chunk's floors, its lights' halos, and its faces' mesh arrays, with
// the faces of glass in `glass`. Either set of mesh arrays is absent when the
// chunk has no such faces.
export function meshCells(volume, table, origin, frame)
{
    const out = emptyMesh();
    const masks = { faces: new Int32Array(CHUNK * CHUNK), weathers: new Int32Array(CHUNK * CHUNK), glows: new Int32Array(CHUNK * CHUNK) };
    const { light, hueOf } = lightField(volume, table);
    const ambientOf = volume.coarse ? fineGlow(volume, table) : () => 0;
    const glowOf = (index) => ambientOf(index) + hueOf(index) * HUE_SHIFT;
    const floors = floorLights(volume.cells, light, table, glowOf);
    const context = { cells: volume.cells, ages: volume.ages ?? new Uint8Array(PADDED * PADDED), light, glowOf, table, origin, isGlass: 0, hasGlass: false };

    context.chips = chipsOf(context);
    addFaces(out, masks, context, frame);

    for(const chip of context.chips.values()) { addChip(out, context, chip, frame); }

    const glass = emptyMesh();

    if(context.hasGlass)
    {
        context.isGlass = 1;
        addFaces(glass, masks, context, frame);
    }

    return { floors, halos: haloSpots(volume.cells, table, origin, frame), ...meshArrays(out), ...(glass.indices.length > 0 ? { glass: meshArrays(glass) } : {}) };
}

function emptyMesh()
{
    return { positions: [], normals: [], uvs: [], layers: [], colours: [], lights: [], weathers: [], glows: [], hues: [], indices: [] };
}

function addFaces(out, masks, context, frame)
{
    for(const direction of DIRECTIONS)
    {
        for(let slice = 0; slice < CHUNK; slice++)
        {
            if(fillMask(masks, context, direction, slice)) { mergeMask(out, masks, direction, slice, context.origin, frame); }
        }
    }
}

function meshArrays(out)
{
    if(out.indices.length === 0) { return {}; }

    return {
        positions: new Float32Array(out.positions),
        normals: new Float32Array(out.normals),
        uvs: new Float32Array(out.uvs),
        layers: new Float32Array(out.layers),
        colours: new Float32Array(out.colours),
        lights: new Float32Array(out.lights),
        weathers: new Float32Array(out.weathers),
        glows: new Float32Array(out.glows),
        hues: new Float32Array(out.hues),
        indices: new Uint32Array(out.indices),
    };
}

// [x, y, z, colour, level] in metres for each light of the chunk, where the
// light cells of one colour that touch, such as a forge's embers, count as
// one light at their middle, at the level of the brightest. The colour is
// 0xrrggbb.
function haloSpots(cells, table, origin, frame)
{
    const seen = new Uint8Array(CHUNK * CHUNK * CHUNK);
    const spots = [];
    const indexOf = (x, y, z) => ((y + MARGIN) * PADDED + z + MARGIN) * PADDED + x + MARGIN;

    for(let start = 0; start < seen.length; start++)
    {
        const [x, y, z] = [start % CHUNK, Math.floor(start / (CHUNK * CHUNK)), Math.floor(start / CHUNK) % CHUNK];
        const block = cells[indexOf(x, y, z)];

        if(seen[start] === 1 || table.lights[block] === 0) { continue; }

        const colour = table.glowKeys[block];
        const group = [[x, y, z]];
        let level = 0;

        seen[start] = 1;

        for(let i = 0; i < group.length; i++)
        {
            const cell = group[i];

            level = Math.max(level, table.lights[cells[indexOf(...cell)]]);

            for(const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]])
            {
                const [nx, ny, nz] = [cell[0] + dx, cell[1] + dy, cell[2] + dz];
                const local = (ny * CHUNK + nz) * CHUNK + nx;
                const isInside = nx >= 0 && ny >= 0 && nz >= 0 && nx < CHUNK && ny < CHUNK && nz < CHUNK;

                if(!isInside || seen[local] === 1) { continue; }

                const neighbour = cells[indexOf(nx, ny, nz)];

                if(table.lights[neighbour] === 0 || table.glowKeys[neighbour] !== colour) { continue; }

                seen[local] = 1;
                group.push([nx, ny, nz]);
            }
        }

        const middle = [0, 1, 2].map((axis) => group.reduce((total, cell) => total + cell[axis], 0) / group.length + 0.5);

        spots.push((origin[0] + middle[0]) / ZoneData.CUBES_PER_METRE - frame.half, (origin[1] + middle[1] - frame.base) / ZoneData.CUBES_PER_METRE, (origin[2] + middle[2]) / ZoneData.CUBES_PER_METRE - frame.half, colour, level);
    }

    return Float32Array.from(spots);
}

// Each cube of the chunk that something can stand on, by its index in the
// chunk, ascending, with the light, the glow and the lamp light's colour of
// the cell above it. `glowOf` gives the last two as glow + hue * HUE_SHIFT.
function floorLights(cells, light, table, glowOf)
{
    const indices = [];
    const levels = [];
    const glows = [];
    const hues = [];
    const above = PADDED * PADDED;

    for(let y = 0; y < CHUNK; y++)
    {
        for(let z = 0; z < CHUNK; z++)
        {
            for(let x = 0; x < CHUNK; x++)
            {
                const index = ((y + MARGIN) * PADDED + z + MARGIN) * PADDED + x + MARGIN;
                const isFloor = table.standable[cells[index]] && !table.standable[cells[index + above]] && !table.opaque[cells[index + above]];

                if(!isFloor) { continue; }

                indices.push((y * CHUNK + z) * CHUNK + x);
                levels.push(light[index + above]);
                glows.push(glowOf(index + above) % HUE_SHIFT);
                hues.push(Math.floor(glowOf(index + above) / HUE_SHIFT));
            }
        }
    }

    return { indices: Uint16Array.from(indices), levels: Uint8Array.from(levels), glows: Uint16Array.from(glows), hues: Uint16Array.from(hues) };
}

/* MASK ***********************************************************************/

// A face mask entry is 0 for no face, or the face's layer + 1, then the light
// of the cell in front of it, then its four corner shades of two bits each.
// Its weather mask entry holds its two overlays; see weatherOf. The mask
// holds the faces of glass when `context.isGlass` is 1, and the rest when it
// is 0. A glass face takes the brighter lamp light of the cells on its two
// sides, and its weather entry holds its frame edges; see frameEdges. A face
// that looks into glass, such as the side of a window's opening, takes the
// frame's texture and does not weather.
function fillMask(masks, context, direction, slice)
{
    const { cells, ages, light, table } = context;
    const { faces: mask, weathers, glows } = masks;
    const { axis, sign, u, v, side } = direction;
    const [stepU, stepV, stepAxis] = [STRIDES[u], STRIDES[v], STRIDES[axis]];
    const layers = table[side];
    let hasFace = false;

    for(let j = 0; j < CHUNK; j++)
    {
        let index = (slice + MARGIN) * stepAxis + MARGIN * stepU + (j + MARGIN) * stepV;

        for(let i = 0; i < CHUNK; i++, index += stepU)
        {
            const block = cells[index];
            const front = index + sign * stepAxis;
            const neighbour = cells[front];
            const chip = context.chips.size > 0 ? context.chips.get(index) : undefined;
            const isChipped = chip !== undefined && ((chip.a === axis && chip.signA === sign) || (chip.b === axis && chip.signB === sign));
            const isGlass = table.glass[block];
            const isHidden = isGlass !== context.isGlass || isChipped || block === 0 || table.hidden[block] === 1 || table.opaque[neighbour] === 1 || (table.clear[block] === 1 && neighbour === block) || (isGlass === 1 && table.glass[neighbour] === 1);

            if(isGlass === 1) { context.hasGlass = true; }

            if(isHidden)
            {
                mask[j * CHUNK + i] = 0;
                continue;
            }

            const isReveal = table.glass[neighbour] === 1 && isGlass === 0;
            const age = isReveal ? 0 : ages[Math.floor(index / PADDED) % PADDED * PADDED + index % PADDED];
            const layer = isReveal ? table.frameLayer : (age > 0 ? wornLayer(context, block, index, age, layers[block]) : layers[block]);
            const lit = isGlass === 1 ? brighterSide(light, front, index - sign * stepAxis) : front;
            const level = isGlass === 1 ? Math.max(light[front] & 0xf0, light[lit] & 0xf0) | (light[lit] & 0xf) : light[front];

            mask[j * CHUNK + i] = ((layer + 1) << 16) | (level << 8) | shadesOf(cells, table.opaque, front, stepU, stepV);
            if(isGlass === 1) { weathers[j * CHUNK + i] = frameEdges(cells, table.glass, index, stepU, stepV); }
            else { weathers[j * CHUNK + i] = age > 0 && table.weathers[block] !== 0 ? weatherOf(context, block, index, front, direction, age / 100) : 0; }
            glows[j * CHUNK + i] = context.glowOf(lit);
            hasFace = true;
        }
    }

    return hasFace;
}

function brighterSide(light, front, behind)
{
    return (light[behind] & 0xf) > (light[front] & 0xf) ? behind : front;
}

// The edges of a glass face that meet a cell that is not glass, which draw a
// frame: 1 at the low end of u, 2 at the high end, 4 at the low end of v and
// 8 at the high end.
function frameEdges(cells, glass, index, stepU, stepV)
{
    const isEdge = (step) => (glass[cells[index + step]] === 1 ? 0 : 1);

    return isEdge(-stepU) | (isEdge(stepU) << 1) | (isEdge(-stepV) << 2) | (isEdge(stepV) << 3);
}

/* WEATHER ********************************************************************/

// From 0 to 1, the same for a cell wherever it is meshed.
function hash(context, index, salt)
{
    const { origin } = context;
    const x = origin[0] - MARGIN + (index % PADDED);
    const z = origin[2] - MARGIN + (Math.floor(index / PADDED) % PADDED);
    const y = origin[1] - MARGIN + Math.floor(index / UP);
    let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177) ^ Math.imul(salt, 2246822519);

    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;

    return (h >>> 0) / 4294967296;
}

function levelOf(amount)
{
    return Math.max(0, Math.min(LEVELS, Math.round(amount * OVERLAY_STRENGTH * LEVELS)));
}

// A block with a worn texture takes it, on every face, in more cells the
// older it is.
function wornLayer(context, block, index, age, layer)
{
    const worn = context.table.worn[block];

    return worn >= 0 && hash(context, index, 7) < (age / 100 - 0.35) * 1.2 ? worn : layer;
}

// Two overlays, each as layer * 4 + level, or 0 for none: moss in the high 16
// bits, and grime or a crack in the low 16. Moss grows only under open sky: on
// a top face, hanging from the top of a side face, and climbing a side face
// from the floor in front of it. Grime streaks down a side face below an
// overhang, up to three cells down.
function weatherOf(context, block, index, front, direction, age)
{
    const { cells, light, table } = context;
    const { opaque, overlays } = table;
    const bits = table.weathers[block];
    const isSide = direction.axis !== 1;
    const isOpenSky = light[front] >> 4 === MAX_LIGHT;
    let moss = 0;
    let streak = 0;

    if(bits & WEATHERS.moss)
    {
        const growth = age * (0.5 + hash(context, front, 1) * 0.8);

        if(!isSide && direction.sign > 0 && isOpenSky) { moss = overlays.mossTop * 4 + levelOf(growth); }
        else if(isSide && isOpenSky && opaque[cells[index + UP]] === 0) { moss = overlays.mossEdge * 4 + levelOf(growth * 0.9); }
        else if(isSide && isOpenSky && opaque[cells[front - UP]] === 1) { moss = overlays.mossFoot * 4 + levelOf(growth * 0.8); }
    }

    if(isSide && bits & WEATHERS.grime)
    {
        for(let k = 1; k <= 3 && streak === 0; k++)
        {
            if(opaque[cells[front + k * UP]] === 1) { streak = overlays.grime * 4 + levelOf(age * (1.15 - k * 0.25) * (0.7 + hash(context, front, 2) * 0.6)); }
        }
    }

    if(isSide && streak % 4 === 0 && bits & WEATHERS.cracks && hash(context, index, 3) < (age - 0.3) * 0.5)
    {
        streak = overlays.cracks * 4 + Math.max(1, levelOf(age - 0.2));
    }

    return ((moss % 4 === 0 ? 0 : moss) << 16) | (streak % 4 === 0 ? 0 : streak);
}

/* CHIPS **********************************************************************/

// Cubes that lose a notch from one exposed edge, by padded index. An edge is
// exposed when the two cells beside it and the cell across it are neither
// opaque nor glass. A chip is a box of fine cubes, FINE to a cube's edge:
// `depthA` deep from face A, `depthB` from face B, and from `from` to `to`
// along the edge.
function chipsOf(context)
{
    const { cells, ages, table } = context;
    const chips = new Map();

    for(let y = 0; y < CHUNK && chips.size < MAX_CHIPS; y++)
    {
        for(let z = 0; z < CHUNK && chips.size < MAX_CHIPS; z++)
        {
            for(let x = 0; x < CHUNK && chips.size < MAX_CHIPS; x++)
            {
                const index = ((y + MARGIN) * PADDED + z + MARGIN) * PADDED + x + MARGIN;
                const block = cells[index];
                const age = ages[(z + MARGIN) * PADDED + x + MARGIN] / 100;

                if((table.weathers[block] & WEATHERS.chips) === 0 || hash(context, index, 11) >= (age - 0.15) * 0.45) { continue; }

                const edges = exposedEdges(cells, table, index);

                if(edges.length === 0) { continue; }

                const [a, signA, b, signB] = edges[Math.floor(hash(context, index, 12) * edges.length)];
                const length = 2 + Math.floor(hash(context, index, 15) * 5);
                const from = 1 + Math.floor(hash(context, index, 16) * (FINE - 1 - length));

                chips.set(index, {
                    index, block, a, signA, b, signB, from, to: from + length,
                    depthA: 1 + Math.floor(hash(context, index, 13) * 3),
                    depthB: 1 + Math.floor(hash(context, index, 14) * 3),
                    cell: [context.origin[0] + x, context.origin[1] + y, context.origin[2] + z],
                });
            }
        }
    }

    return chips;
}

// [axis A, its sign, axis B, its sign], leaving out the edges along the
// cube's bottom.
function exposedEdges(cells, table, index)
{
    const edges = [];
    const isOpen = (cell) => table.opaque[cells[cell]] === 0 && table.glass[cells[cell]] === 0;

    for(const [a, b] of [[0, 1], [0, 2], [1, 2]])
    {
        for(const signA of [1, -1])
        {
            for(const signB of [1, -1])
            {
                if((a === 1 && signA < 0) || (b === 1 && signB < 0)) { continue; }

                const besideA = index + signA * STRIDES[a];
                const besideB = index + signB * STRIDES[b];

                if(isOpen(besideA) && isOpen(besideB) && isOpen(besideA + signB * STRIDES[b])) { edges.push([a, signA, b, signB]); }
            }
        }
    }

    return edges;
}

function addChip(out, context, chip, frame)
{
    const { a, signA, b, signB, from, to, depthA, depthB } = chip;
    const along = 3 - a - b;
    const notch = [[0, FINE], [0, FINE], [0, FINE]];

    notch[a] = signA > 0 ? [FINE - depthA, FINE] : [0, depthA];
    notch[b] = signB > 0 ? [FINE - depthB, FINE] : [0, depthB];
    notch[along] = [from, to];

    for(const [axis, sign, other, otherSign] of [[a, signA, b, signB], [b, signB, a, signA]])
    {
        const front = chip.index + sign * STRIDES[axis];
        const direction = DIRECTIONS.find((entry) => entry.axis === axis && entry.sign === sign);
        const layer = wornLayer(context, chip.block, chip.index, context.ages[Math.floor(chip.index / PADDED) % PADDED * PADDED + chip.index % PADDED], context.table[direction.side][chip.block]);
        const age = context.ages[Math.floor(chip.index / PADDED) % PADDED * PADDED + chip.index % PADDED] / 100;
        const face = { layer, light: context.light[front], glow: context.glowOf(front), weather: weatherOf(context, chip.block, chip.index, front, direction, age) };
        const shades = cornerShades(context, front, direction);
        const plane = sign > 0 ? FINE : 0;
        const rest = otherSign > 0 ? [0, FINE - notch[other][1] + notch[other][0]] : [notch[other][1], FINE];
        const pieces = [{ [along]: [0, from], [other]: [0, FINE] }, { [along]: [to, FINE], [other]: [0, FINE] }, { [along]: [from, to], [other]: rest }];

        for(const piece of pieces) { addRect(out, direction, chip.cell, plane, piece, face, shades, frame); }

        addRect(out, direction, chip.cell, sign > 0 ? FINE - notch[axis][1] + notch[axis][0] : notch[axis][1], { [along]: notch[along], [other]: notch[other] }, { ...face, weather: 0 }, null, frame);
    }

    const ends = [[from, 1], [to, -1]];
    const light = context.light[chip.index + signA * STRIDES[a]];
    const glow = context.glowOf(chip.index + signA * STRIDES[a]);

    for(const [plane, sign] of ends)
    {
        const direction = DIRECTIONS.find((entry) => entry.axis === along && entry.sign === sign);

        addRect(out, direction, chip.cell, plane, { [a]: notch[a], [b]: notch[b] }, { layer: context.table[direction.side][chip.block], light, glow, weather: 0 }, null, frame);
    }
}

// The shades of a face's four corners, in CORNERS order.
function cornerShades(context, front, direction)
{
    const packed = shadesOf(context.cells, context.table.opaque, front, STRIDES[direction.u], STRIDES[direction.v]);

    return CORNERS.map((corner, i) => SHADES[(packed >> (i * 2)) & 3]);
}

// A rectangle on the plane `plane` fine cubes into the cell along the
// direction's axis, spanning `span[u]` and `span[v]` fine cubes. `shades`
// holds the face's corner shades to blend across it, or null for an inner
// face of a chip.
function addRect(out, direction, cell, plane, span, face, shades, frame)
{
    const { axis, sign, u, v } = direction;
    const [lowU, highU] = span[u];
    const [lowV, highV] = span[v];

    if(lowU >= highU || lowV >= highV) { return; }

    const first = out.positions.length / 3;
    const normal = [0, 0, 0];
    const values = [];

    normal[axis] = sign;

    CORNERS.forEach(([cornerU, cornerV]) =>
    {
        const fineU = cornerU ? highU : lowU;
        const fineV = cornerV ? highV : lowV;
        const at = [0, 0, 0];

        at[axis] = cell[axis] + plane / FINE;
        at[u] = cell[u] + fineU / FINE;
        at[v] = cell[v] + fineV / FINE;

        const [tu, tv] = direction.uv(at);
        const [su, sv] = [fineU / FINE, fineV / FINE];
        const shade = shades ? (shades[0] * (1 - su) + shades[1] * su) * (1 - sv) + (shades[3] * (1 - su) + shades[2] * su) * sv : NOTCH_SHADE;

        values.push(shade);
        out.positions.push(at[0] / ZoneData.CUBES_PER_METRE - frame.half, (at[1] - frame.base) / ZoneData.CUBES_PER_METRE, at[2] / ZoneData.CUBES_PER_METRE - frame.half);
        out.normals.push(...normal);
        out.uvs.push(tu * frame.perCell, tv * frame.perCell);
        out.layers.push(face.layer);
        out.colours.push(shade, shade, shade);
        out.lights.push((face.light >> 4) / MAX_LIGHT, (face.light & 0xf) / MAX_LIGHT);
        out.weathers.push(face.weather >>> 16, face.weather & 0xffff);
        out.glows.push(face.glow % HUE_SHIFT);
        out.hues.push(Math.floor(face.glow / HUE_SHIFT));
    });

    const order = values[0] + values[2] > values[1] + values[3] ? [1, 2, 3, 1, 3, 0] : [0, 1, 2, 0, 2, 3];
    const isAnticlockwise = (v === (u + 1) % 3) === (sign > 0);

    out.indices.push(...(isAnticlockwise ? order : [order[0], order[2], order[1], order[3], order[5], order[4]]).map((index) => first + index));
}

// Vertex ambient occlusion, after
// https://0fps.net/2013/07/03/ambient-occlusion-for-minecraft-like-worlds/
function shadesOf(cells, opaque, front, stepU, stepV)
{
    let packed = 0;

    for(let corner = 0; corner < 4; corner++)
    {
        const du = CORNERS[corner][0] * 2 - 1;
        const dv = CORNERS[corner][1] * 2 - 1;
        const a = opaque[cells[front + du * stepU]];
        const b = opaque[cells[front + dv * stepV]];
        const shade = a && b ? 3 : a + b + opaque[cells[front + du * stepU + dv * stepV]];

        packed |= shade << (corner * 2);
    }

    return packed;
}

/* QUADS **********************************************************************/

function mergeMask(out, masks, direction, slice, origin, frame)
{
    const { faces: mask, weathers, glows } = masks;

    for(let j = 0; j < CHUNK; j++)
    {
        for(let i = 0; i < CHUNK;)
        {
            const key = mask[j * CHUNK + i];
            const weather = weathers[j * CHUNK + i];
            const glow = glows[j * CHUNK + i];

            if(key === 0)
            {
                i++;
                continue;
            }

            let width = 1;
            let height = 1;

            while(i + width < CHUNK && mask[j * CHUNK + i + width] === key && weathers[j * CHUNK + i + width] === weather && glows[j * CHUNK + i + width] === glow) { width++; }
            while(j + height < CHUNK && rowMatches(masks, key, weather, glow, i, j + height, width)) { height++; }

            for(let row = j; row < j + height; row++) { mask.fill(0, row * CHUNK + i, row * CHUNK + i + width); }

            addQuad(out, direction, key, weather, glow, [slice, i, j, width, height], origin, frame);
            i += width;
        }
    }
}

function rowMatches({ faces, weathers, glows }, key, weather, glow, i, j, width)
{
    for(let k = i; k < i + width; k++) { if(faces[j * CHUNK + k] !== key || weathers[j * CHUNK + k] !== weather || glows[j * CHUNK + k] !== glow) { return false; } }

    return true;
}

function addQuad(out, direction, key, weather, glow, [slice, i, j, width, height], origin, frame)
{
    const { axis, sign, u, v } = direction;
    const first = out.positions.length / 3;
    const layer = (key >> 16) - 1;
    const light = (key >> 8) & 0xff;
    const shades = CORNERS.map((corner, index) => (key >> (index * 2)) & 3);
    const normal = [0, 0, 0];

    normal[axis] = sign;

    CORNERS.forEach(([cornerU, cornerV], index) =>
    {
        const cell = [0, 0, 0];

        cell[axis] = origin[axis] + slice + (sign > 0 ? 1 : 0);
        cell[u] = origin[u] + i + cornerU * width;
        cell[v] = origin[v] + j + cornerV * height;

        const [tu, tv] = direction.uv(cell);
        const shade = SHADES[shades[index]];

        out.positions.push(cell[0] / ZoneData.CUBES_PER_METRE - frame.half, (cell[1] - frame.base) / ZoneData.CUBES_PER_METRE, cell[2] / ZoneData.CUBES_PER_METRE - frame.half);
        out.normals.push(...normal);
        out.uvs.push(tu * frame.perCell, tv * frame.perCell);
        out.layers.push(layer);
        out.colours.push(shade, shade, shade);
        out.lights.push((light >> 4) / MAX_LIGHT, (light & 0xf) / MAX_LIGHT);
        out.weathers.push(weather >>> 16, weather & 0xffff);
        out.glows.push(glow % HUE_SHIFT);
        out.hues.push(Math.floor(glow / HUE_SHIFT));
    });

    out.indices.push(...triangles(shades, (v === (u + 1) % 3) === (sign > 0)).map((index) => first + index));
}

// The corners run anticlockwise seen from the side the face points to when
// u x v points along the face's normal. The quad splits along the diagonal
// between its darker corners.
function triangles(shades, isAnticlockwise)
{
    const order = shades[0] + shades[2] < shades[1] + shades[3] ? [1, 2, 3, 1, 3, 0] : [0, 1, 2, 0, 2, 3];

    return isAnticlockwise ? order : [order[0], order[2], order[1], order[3], order[5], order[4]];
}
