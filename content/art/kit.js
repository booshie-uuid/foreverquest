import * as Props from "./props.js";

// Positions are whole cubes from the building's origin: x across its front,
// y up from its ground floor and z towards its front, which faces +z. A
// footprint of `width` by `depth` cubes runs from -width/2 to width/2 - 1.

const CUBE = 1 / 3;
const STOREY = 10;
const DOOR_HEIGHT = 7;
const DOOR_WIDTH = 3;
const HEADROOM = 7;
const STEPS = STOREY;
const STAIR_WIDTH = 4;
const STAIR_ENTRY = 3;
const FOUNDATION = 5;
const CUPBOARD = { length: 12, deep: 6 };
const WINDOW = { width: 2, bottom: 3, height: 3 };
const LAMP_SPACING = 9;
const KEEP_CLEAR = 2;


/******************************************************************************/
/* LAYOUT                                                                     */
/******************************************************************************/

// The cubes of a building, each a world texture name, or null for a cube
// kept empty.
class Layout
{
    constructor()
    {
        this.cells = new Map();
    }

    // From one corner up to, not including, the other.
    box(from, to, texture)
    {
        for(let y = from[1]; y < to[1]; y++)
        {
            for(let z = from[2]; z < to[2]; z++)
            {
                for(let x = from[0]; x < to[0]; x++) { this.cells.set(x + "," + y + "," + z, texture); }
            }
        }
    }

    clear(from, to)
    {
        this.box(from, to, null);
    }

    // Each run of one texture along x becomes one block.
    emit(builder)
    {
        const rows = new Map();

        for(const [key, texture] of this.cells)
        {
            if(texture === null) { continue; }

            const [x, y, z] = key.split(",").map(Number);
            const row = y + "," + z;

            if(!rows.has(row)) { rows.set(row, []); }

            rows.get(row).push([x, texture]);
        }

        for(const [row, entries] of rows)
        {
            const [y, z] = row.split(",").map(Number);

            entries.sort((a, b) => a[0] - b[0]);

            for(let i = 0; i < entries.length;)
            {
                let end = i + 1;

                while(end < entries.length && entries[end][0] === entries[end - 1][0] + 1 && entries[end][1] === entries[i][1]) { end++; }

                const length = end - i;

                Props.block(builder, [length * CUBE, CUBE, CUBE], [(entries[i][0] + length / 2) * CUBE, (y + 0.5) * CUBE, (z + 0.5) * CUBE], entries[i][1]);
                i = end;
            }
        }
    }
}


/******************************************************************************/
/* WALLS                                                                      */
/******************************************************************************/

// A wall's cubes at `along` cubes from the middle of its side, as [x, z], and
// the direction into the building.
function wallAt(spec, side, along)
{
    const [halfWidth, halfDepth] = [spec.width / 2, spec.depth / 2];

    return {
        front: { cell: [along, halfDepth - 1], inward: [0, -1] },
        back: { cell: [along, -halfDepth], inward: [0, 1] },
        left: { cell: [-halfWidth, along], inward: [1, 0] },
        right: { cell: [halfWidth - 1, along], inward: [-1, 0] },
    }[side];
}

// The box of cubes `span` wide along a side's wall, from `along` - 1, and
// `deep` cubes into the building.
function spanBox(spec, side, along, span, [bottom, top], deep = 1)
{
    const { cell, inward } = wallAt(spec, side, along - 1);
    const isAcross = side === "front" || side === "back";
    const reach = [inward[0] * (deep - 1), inward[1] * (deep - 1)];
    const end = [cell[0] + (isAcross ? span - 1 : 0) + reach[0], cell[1] + (isAcross ? 0 : span - 1) + reach[1]];
    const low = [Math.min(cell[0], end[0]), Math.min(cell[1], end[1])];
    const high = [Math.max(cell[0], end[0]) + 1, Math.max(cell[1], end[1]) + 1];

    return [[low[0], bottom, low[1]], [high[0], top, high[1]]];
}

function shell(layout, spec)
{
    const { width, depth, storeys, walls } = spec;
    const [x0, z0, x1, z1] = [-width / 2, -depth / 2, width / 2, depth / 2];

    layout.box([x0, -1 - FOUNDATION, z0], [x1, -1, z1], "stone");
    layout.box([x0, -1, z0], [x1, 0, z1], spec.groundFloor ?? "stone");

    for(let storey = 0; storey < storeys; storey++)
    {
        const bottom = storey * STOREY;
        const top = bottom + STOREY - 1;
        const texture = storey === 0 ? walls.ground : walls.upper ?? walls.ground;

        layout.box([x0, bottom, z0], [x1, top, z1], texture);
        layout.clear([x0 + 1, bottom, z0 + 1], [x1 - 1, top, z1 - 1]);
        layout.box([x0, top, z0], [x1, top + 1, z1], spec.floor ?? "planks");

        if(walls.frame && storey > 0)
        {
            for(let x = x0; x < x1; x += 4) { posts(layout, [[x, z0], [x, z1 - 1]], bottom, top, walls.frame); }
            for(let z = z0; z < z1; z += 4) { posts(layout, [[x0, z], [x1 - 1, z]], bottom, top, walls.frame); }

            ring(layout, spec, bottom - 1, walls.frame);
        }
    }

    if(walls.frame)
    {
        posts(layout, [[x0, z0], [x1 - 1, z0], [x0, z1 - 1], [x1 - 1, z1 - 1]], 0, storeys * STOREY, walls.frame);

        ring(layout, spec, storeys * STOREY - 1, walls.frame);
    }
}

function posts(layout, points, bottom, top, texture)
{
    for(const [x, z] of points) { layout.box([x, bottom, z], [x + 1, top, z + 1], texture); }
}

// A beam round the outside of the walls at height `y`.
function ring(layout, spec, y, texture)
{
    const [x0, z0, x1, z1] = [-spec.width / 2, -spec.depth / 2, spec.width / 2, spec.depth / 2];

    layout.box([x0, y, z0], [x1, y + 1, z0 + 1], texture);
    layout.box([x0, y, z1 - 1], [x1, y + 1, z1], texture);
    layout.box([x0, y, z0], [x0 + 1, y + 1, z1], texture);
    layout.box([x1 - 1, y, z0], [x1, y + 1, z1], texture);
}

// A parapet 2 cubes tall at `y`, gapped every other pair of cubes on its top
// course.
function battlements(layout, spec, y, texture)
{
    const [x0, z0, x1, z1] = [-spec.width / 2, -spec.depth / 2, spec.width / 2, spec.depth / 2];

    ring(layout, spec, y, texture);

    for(let x = x0; x < x1; x += 4)
    {
        layout.box([x, y + 1, z0], [Math.min(x + 2, x1), y + 2, z0 + 1], texture);
        layout.box([x, y + 1, z1 - 1], [Math.min(x + 2, x1), y + 2, z1], texture);
    }

    for(let z = z0; z < z1; z += 4)
    {
        layout.box([x0, y + 1, z], [x0 + 1, y + 2, Math.min(z + 2, z1)], texture);
        layout.box([x1 - 1, y + 1, z], [x1, y + 2, Math.min(z + 2, z1)], texture);
    }
}

// A stepped gable roof with its ridge along `ridge`, overhanging the walls by
// a cube, and gable ends in the top storey's wall texture; or a flat roof
// with battlements.
function roof(layout, spec)
{
    const { width, depth, storeys, roof: { texture, ridge = "x", isFlat = false } } = spec;

    if(isFlat)
    {
        battlements(layout, spec, storeys * STOREY, texture);
        return;
    }

    const isAlongX = ridge === "x";
    const [length, span] = isAlongX ? [width, depth] : [depth, width];
    const base = storeys * STOREY;
    const gable = spec.walls.upper ?? spec.walls.ground;
    const put = (along, across, y, material) =>
    {
        const [x, z] = isAlongX ? [along, across] : [across, along];

        layout.box([x, y, z], [x + 1, y + 1, z + 1], material);
    };

    for(let layer = 0; ; layer++)
    {
        const near = -span / 2 - 1 + layer;
        const far = span / 2 - layer;

        if(near > far) { break; }

        for(let along = -length / 2 - 1; along < length / 2 + 1; along++)
        {
            put(along, near, base + layer, texture);
            put(along, far, base + layer, texture);
        }

        for(let across = near + 1; across < far; across++)
        {
            put(-length / 2, across, base + layer, gable);
            put(length / 2 - 1, across, base + layer, gable);
        }
    }
}


/******************************************************************************/
/* OPENINGS                                                                   */
/******************************************************************************/

// A doorway `width` cubes wide, 3 by default, on storey `storey`; a doorway
// on the front of the ground storey is the prefab's door.
function door(layout, spec, entry, result)
{
    const side = entry.side ?? "front";
    const width = entry.width ?? DOOR_WIDTH;
    const bottom = (entry.storey ?? 0) * STOREY;
    const start = (entry.at ?? 0) - Math.floor((width - DOOR_WIDTH) / 2);
    const [from, to] = spanBox(spec, side, start, width, [bottom, bottom + DOOR_HEIGHT]);
    const [lintelFrom, lintelTo] = spanBox(spec, side, start - 1, width + 2, [bottom + DOOR_HEIGHT, bottom + DOOR_HEIGHT + 1]);

    layout.box(lintelFrom, lintelTo, spec.walls.frame ?? "timber");
    layout.clear(from, to);

    if(side !== "front" || bottom > 0 || result.doors.length > 0) { return; }

    const middle = [(from[0] + to[0]) / 2, (from[2] + to[2]) / 2];

    result.doors.push({ size: [width * CUBE, DOOR_HEIGHT * CUBE, 0.8], at: [middle[0] * CUBE, (DOOR_HEIGHT / 2) * CUBE, middle[1] * CUBE], height: DOOR_HEIGHT });
}

function window(layout, spec, entry)
{
    const bottom = (entry.storey ?? 0) * STOREY + WINDOW.bottom;
    const [from, to] = spanBox(spec, entry.side ?? "front", entry.at ?? 0, WINDOW.width, [bottom, bottom + WINDOW.height]);

    layout.box(from, to, entry.isBoarded ? "oldPlanks" : entry.glass ?? "leadedGlass");
}


/******************************************************************************/
/* STAIRS                                                                     */
/******************************************************************************/

// A straight flight of STEPS steps up from storey `storey`, against the wall
// on `side`, its first step `from` cubes along that wall. The floor above is
// left open over every step but the last, which is level with it, so no step
// has less than HEADROOM, and neither does the cube beside it that an
// entity's width reaches into.
function stairs(layout, spec, flight)
{
    const { side, storey, from } = flight;
    const bottom = storey * STOREY;
    const ceiling = bottom + STOREY - 1;

    for(let step = 0; step < STEPS; step++)
    {
        const [low, high] = spanBox(spec, side, from + step + 1, 1, [bottom, bottom + step + 1], STAIR_WIDTH + 1);
        const inner = stepInside(spec, side, low, high);

        layout.box(inner[0], inner[1], spec.stair ?? "oldPlanks");

        if(step < STEPS - 1) { layout.clear([inner[0][0], ceiling, inner[0][2]], [inner[1][0], ceiling + 1, inner[1][2]]); }
    }
}

// A flight of STEPS steps outside the wall on `side`, climbing from `from`
// cubes along it from the ground to storey `storey` + 1, built solid below,
// with a landing 3 cubes long at its top beside a door on that storey.
function outsideStairs(layout, spec, flight)
{
    const { side, storey, from } = flight;
    const top = (storey + 1) * STOREY;
    const { inward } = wallAt(spec, side, 0);

    for(let step = 0; step < STEPS + 3; step++)
    {
        const height = Math.min(top, storey * STOREY + step + 1);
        const { cell } = wallAt(spec, side, from + step);

        for(let out = 1; out <= STAIR_WIDTH; out++)
        {
            const [x, z] = [cell[0] - inward[0] * out, cell[1] - inward[1] * out];

            layout.box([x, -1, z], [x + 1, height, z + 1], spec.walls.ground);
        }
    }
}

// The box less the wall it starts in.
function stepInside(spec, side, low, high)
{
    const inward = wallAt(spec, side, 0).inward;
    const from = [...low];
    const to = [...high];

    if(inward[0] > 0) { from[0] += 1; }
    if(inward[0] < 0) { to[0] -= 1; }
    if(inward[1] > 0) { from[2] += 1; }
    if(inward[1] < 0) { to[2] -= 1; }

    return [from, to];
}

// A walled space against the wall on `side`, big enough to hold a stair to
// the storeys above, closed by a locked door at `at`. It runs `length` cubes
// along the wall, centred on the door, or the wall's whole length with
// `isFull`, and is `deep` cubes deep, walls included.
function lockedStairs(layout, spec, entry, result)
{
    const { side, storey, at = 0 } = entry;
    const bottom = storey * STOREY;
    const top = bottom + STOREY - 1;
    const { start, length, deep } = cupboardOf(spec, entry);
    const [outerFrom, outerTo] = spanBox(spec, side, start + 1, length, [bottom, top], deep);
    const [innerFrom, innerTo] = spanBox(spec, side, start + 2, length - 2, [bottom, top], deep - 1);
    const [doorFrom, doorTo] = spanBox(spec, side, at - 1, DOOR_WIDTH, [bottom, bottom + DOOR_HEIGHT], deep);
    const inward = wallAt(spec, side, 0).inward;
    const texture = storey === 0 ? spec.walls.ground : spec.walls.upper ?? spec.walls.ground;

    layout.box(outerFrom, outerTo, texture);
    layout.clear(...stepInside(spec, side, innerFrom, innerTo));

    const face = inward[0] + inward[1] > 0 ? [doorTo[0] - 1, doorTo[2] - 1] : [doorFrom[0], doorFrom[2]];
    const plane = inward[1] !== 0 ? [doorFrom[0], face[1], doorTo[0], face[1] + 1] : [face[0], doorFrom[2], face[0] + 1, doorTo[2]];

    layout.clear([plane[0], bottom, plane[1]], [plane[2], bottom + DOOR_HEIGHT, plane[3]]);
    result.objects.push({ object: "lockedDoor", at: [((plane[0] + plane[2]) / 2) * CUBE, bottom * CUBE, ((plane[1] + plane[3]) / 2) * CUBE], angle: inward[1] !== 0 ? 0 : Math.PI / 2 });
}


/******************************************************************************/
/* BUILDING                                                                   */
/******************************************************************************/

// A prefab builder for a building described by `spec`; see docs/world.md.
export function building(spec)
{
    return (builder) =>
    {
        const layout = new Layout();
        const result = { doors: [], objects: [], clears: [], problems: checked(spec), collider: { x: 0, z: 0, halfWidth: (spec.width * CUBE) / 2, halfDepth: (spec.depth * CUBE) / 2, angle: 0 } };

        shell(layout, spec);
        roof(layout, spec);

        for(const entry of spec.windows ?? []) { window(layout, spec, entry); }
        for(const entry of spec.doors ?? [{}]) { door(layout, spec, entry, result); }
        for(const flight of spec.stairs ?? []) { stairs(layout, spec, flight); }
        for(const flight of spec.outsideStairs ?? []) { outsideStairs(layout, spec, flight); }

        shafts(layout, spec);
        for(const entry of spec.lockedStairs ?? []) { lockedStairs(layout, spec, entry, result); }

        if(spec.lamps !== false)
        {
            for(let storey = 0; storey < spec.storeys; storey++) { lamps(spec, storey, result); }
        }

        spec.details?.({ box: (from, to, texture) => layout.box(from, to, texture), clear: (from, to) => layout.clear(from, to), object: (entry) => result.objects.push(entry) });

        layout.emit(builder);
        result.clears.push({ size: [spec.width * CUBE, spec.storeys * STOREY * CUBE, spec.depth * CUBE], at: [0, (spec.storeys * STOREY * CUBE) / 2, 0] });

        return result;
    };
}

// The first cube along the wall, the length and the depth of a locked stair
// cupboard.
function cupboardOf(spec, entry)
{
    const wall = entry.side === "front" || entry.side === "back" ? spec.width : spec.depth;
    const length = entry.isFull ? wall - 2 : entry.length ?? CUPBOARD.length;
    const start = entry.isFull ? -wall / 2 + 1 : (entry.at ?? 0) - Math.floor(length / 2) + 1;

    return { start, length, deep: entry.deep ?? CUPBOARD.deep };
}

// The boxes a lantern must keep out of on a storey: a stair on it or below
// it with the floor before its first step, a lift shaft, and a locked stair
// cupboard, each with KEEP_CLEAR cubes to spare. A climber stepping onto a
// stair still overlaps the column behind it, under the lantern's bottom.
function keptClear(spec, storey)
{
    const flights = (spec.stairs ?? []).filter((flight) => flight.storey === storey || flight.storey === storey - 1);
    const cupboards = (spec.lockedStairs ?? []).filter((entry) => entry.storey === storey).map((entry) =>
    {
        const { start, length, deep } = cupboardOf(spec, entry);

        return spanBox(spec, entry.side, start + 1, length, [0, 1], deep);
    });
    const shafts = (spec.lifts ?? []).filter((lift) => lift.box && storey <= lift.storey).map(({ box }) => [[box[0], 0, box[1]], [box[2], 1, box[3]]]);

    return [...flights.map((flight) => spanBox(spec, flight.side, flight.from + 1 - STAIR_ENTRY, STEPS + STAIR_ENTRY, [0, 1], STAIR_WIDTH + 1)), ...cupboards, ...shafts];
}

// Lanterns hung from a storey's ceiling, their bottoms HEADROOM cubes up,
// every LAMP_SPACING cubes each way. A lantern that would hang over a stair,
// a lift shaft or a cupboard moves to the nearest clear spot within half the
// spacing, the front first when two are as near.
function lamps(spec, storey, result)
{
    const boxes = keptClear(spec, storey);
    const isKept = (x, z) => boxes.some(([from, to]) => x >= from[0] - KEEP_CLEAR && x < to[0] + KEEP_CLEAR && z >= from[2] - KEEP_CLEAR && z < to[2] + KEEP_CLEAR);
    const isInside = (x, z) => x >= -spec.width / 2 + 1 && x < spec.width / 2 - 2 && z >= -spec.depth / 2 + 1 && z < spec.depth / 2 - 2;
    const reach = Math.floor(LAMP_SPACING / 2);
    const offsets = [];

    for(let dx = -reach; dx <= reach; dx++) { for(let dz = -reach; dz <= reach; dz++) { offsets.push([dx, dz]); } }

    offsets.sort(([ax, az], [bx, bz]) => Math.hypot(ax, az) - Math.hypot(bx, bz) || bz - az);

    for(let x = -spec.width / 2 + LAMP_SPACING / 2; x < spec.width / 2 - 2; x += LAMP_SPACING)
    {
        for(let z = -spec.depth / 2 + LAMP_SPACING / 2; z < spec.depth / 2 - 2; z += LAMP_SPACING)
        {
            const [column, row] = [Math.round(x), Math.round(z)];
            const clear = offsets.map(([dx, dz]) => [column + dx, row + dz]).find(([at, along]) => isInside(at, along) && !isKept(at, along));

            if(!clear) { continue; }

            result.objects.push({ object: "lantern", at: [(clear[0] + 0.5) * CUBE, (storey * STOREY + HEADROOM) * CUBE, (clear[1] + 0.5) * CUBE], angle: 0 });
        }
    }
}

// Opens the floors a lift's shaft passes through.
function shafts(layout, spec)
{
    for(const { box, storey } of (spec.lifts ?? []).filter((lift) => lift.box))
    {
        for(let below = 0; below < storey; below++)
        {
            const floor = below * STOREY + STOREY - 1;

            layout.clear([box[0], floor, box[1]], [box[2], floor + 1, box[3]]);
        }
    }
}

// The creator's rules: every upper storey is reached by a stair, a lift or a
// locked stair door on a storey below it; a stair has STAIR_ENTRY cubes of
// floor before its first step and a cube of floor after its last; and a
// footprint has even sides so it sits on whole cubes.
function checked(spec)
{
    const problems = [];
    const reached = new Set([0]);

    if(spec.width % 2 !== 0 || spec.depth % 2 !== 0) { problems.push("needs a footprint with even sides"); }

    for(const flight of spec.stairs ?? [])
    {
        const length = flight.side === "front" || flight.side === "back" ? spec.width : spec.depth;

        reached.add(flight.storey + 1);

        if(flight.from - STAIR_ENTRY < -length / 2 + 1) { problems.push("has a stair with less than " + STAIR_ENTRY + " cubes to walk onto it along its " + flight.side + " wall"); }
        if(flight.from + STEPS > length / 2 - 2) { problems.push("has a stair with no floor to step off onto along its " + flight.side + " wall"); }
    }
    for(const lift of spec.lifts ?? []) { reached.add(lift.storey); }
    for(const flight of spec.outsideStairs ?? []) { reached.add(flight.storey + 1); }

    const lowestLock = Math.min(...(spec.lockedStairs ?? []).map((entry) => entry.storey));

    for(let storey = 1; storey < spec.storeys; storey++)
    {
        if(!reached.has(storey) && !(lowestLock < storey)) { problems.push("has no stair, lift or locked stair door to storey " + storey); }
    }

    return problems;
}

export const RULES = { STOREY, DOOR_HEIGHT, HEADROOM };
