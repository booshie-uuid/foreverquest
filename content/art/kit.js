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
const STAIR_WIDTH = 3;
const WINDOW = { width: 2, bottom: 3, height: 3 };


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

// A stepped gable roof with its ridge along `ridge`, overhanging the walls by
// a cube, and gable ends in the top storey's wall texture.
function roof(layout, spec)
{
    const { width, depth, storeys, roof: { texture, ridge = "x" } } = spec;
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

function door(layout, spec, entry, result)
{
    const side = entry.side ?? "front";
    const [from, to] = spanBox(spec, side, entry.at ?? 0, DOOR_WIDTH, [0, DOOR_HEIGHT]);
    const [lintelFrom, lintelTo] = spanBox(spec, side, (entry.at ?? 0) - 1, DOOR_WIDTH + 2, [DOOR_HEIGHT, DOOR_HEIGHT + 1]);

    layout.box(lintelFrom, lintelTo, spec.walls.frame ?? "timber");
    layout.clear(from, to);

    if(side !== "front") { return; }

    const middle = [(from[0] + to[0]) / 2, (from[2] + to[2]) / 2];

    result.doors.push({ size: [DOOR_WIDTH * CUBE, DOOR_HEIGHT * CUBE, 0.8], at: [middle[0] * CUBE, (DOOR_HEIGHT / 2) * CUBE, middle[1] * CUBE], height: DOOR_HEIGHT });
}

function window(layout, spec, entry)
{
    const bottom = (entry.storey ?? 0) * STOREY + WINDOW.bottom;
    const [from, to] = spanBox(spec, entry.side ?? "front", entry.at ?? 0, WINDOW.width, [bottom, bottom + WINDOW.height]);

    layout.box(from, to, entry.isLit === false ? "oldPlanks" : "glow");
}


/******************************************************************************/
/* STAIRS                                                                     */
/******************************************************************************/

// A straight flight of STEPS steps up from storey `storey`, against the wall
// on `side`, climbing from `from` cubes along that wall. The floor above is
// left open over every step whose headroom would be under HEADROOM.
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

        if(step < STEPS - 1 && ceiling - (bottom + step + 1) < HEADROOM) { layout.clear([inner[0][0], ceiling, inner[0][2]], [inner[1][0], ceiling + 1, inner[1][2]]); }
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

// A cupboard against the wall on `side`, closed by a locked door, which
// implies a stair to the storeys above.
function lockedStairs(layout, spec, entry, result)
{
    const { side, storey, at = 0 } = entry;
    const bottom = storey * STOREY;
    const top = bottom + STOREY - 1;
    const [outerFrom, outerTo] = spanBox(spec, side, at - 1, DOOR_WIDTH + 2, [bottom, top], 5);
    const [innerFrom, innerTo] = spanBox(spec, side, at, DOOR_WIDTH, [bottom, top], 4);
    const [doorFrom, doorTo] = spanBox(spec, side, at, DOOR_WIDTH, [bottom, bottom + DOOR_HEIGHT], 5);
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
        for(const entry of spec.lockedStairs ?? []) { lockedStairs(layout, spec, entry, result); }

        spec.details?.({ box: (from, to, texture) => layout.box(from, to, texture), clear: (from, to) => layout.clear(from, to), object: (entry) => result.objects.push(entry) });

        layout.emit(builder);
        result.clears.push({ size: [spec.width * CUBE, spec.storeys * STOREY * CUBE, spec.depth * CUBE], at: [0, (spec.storeys * STOREY * CUBE) / 2, 0] });

        return result;
    };
}

// The owner's rules: every upper storey is reached by a stair, a lift or a
// locked stair door on a storey below it, and a footprint has even sides so
// it sits on whole cubes.
function checked(spec)
{
    const problems = [];
    const reached = new Set([0]);

    if(spec.width % 2 !== 0 || spec.depth % 2 !== 0) { problems.push("needs a footprint with even sides"); }

    for(const flight of spec.stairs ?? [])
    {
        const length = flight.side === "front" || flight.side === "back" ? spec.width : spec.depth;

        reached.add(flight.storey + 1);

        if(flight.from < -length / 2 + 1 || flight.from + STEPS > length / 2 - 1) { problems.push("has a stair that does not fit along its " + flight.side + " wall"); }
    }
    for(const lift of spec.lifts ?? []) { reached.add(lift.storey); }

    const lowestLock = Math.min(...(spec.lockedStairs ?? []).map((entry) => entry.storey));

    for(let storey = 1; storey < spec.storeys; storey++)
    {
        if(!reached.has(storey) && !(lowestLock < storey)) { problems.push("has no stair, lift or locked stair door to storey " + storey); }
    }

    return problems;
}

export const RULES = { STOREY, DOOR_HEIGHT, HEADROOM };
