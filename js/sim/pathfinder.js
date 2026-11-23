// A* over the zone's columns, one node per column a cylinder can stand in.
// https://www.redblobgames.com/pathfinding/a-star/introduction.html

const CELL = 1 / 3;
const MAX_NODES = 6000;
const MAX_DROP = 1;
const SAMPLE = CELL / 2;
const STRAIGHT_LOOKAHEAD = 24;
const NEIGHBOURS =
[
    [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
    [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
];


/******************************************************************************/
/* SEARCH                                                                     */
/******************************************************************************/

// Returns points in metres from `from` to `to`, or to the reachable column
// nearest it, or null when the cylinder cannot move at all.
export function find(zone, from, to, radius)
{
    const start = nodeAt(zone, from.x, from.z, from.y);
    const goal = zone.columnOf(to.x, to.z);
    const open = new Heap();
    const nodes = new Map([[start.key, { ...start, cost: 0, parent: null, isClosed: false }]]);
    let nearest = nodes.get(start.key);
    let expanded = 0;

    open.push(start.key, estimate(start, goal));

    while(open.size > 0 && expanded < MAX_NODES)
    {
        const node = nodes.get(open.pop());

        if(node.isClosed) { continue; }

        node.isClosed = true;
        expanded++;

        if(estimate(node, goal) < estimate(nearest, goal)) { nearest = node; }
        if(node.column === goal[0] && node.row === goal[1]) { break; }

        for(const next of neighbours(zone, node, radius))
        {
            const known = nodes.get(next.key);
            const cost = node.cost + next.step;

            if(known && (known.isClosed || known.cost <= cost)) { continue; }

            nodes.set(next.key, { ...next, cost, parent: node, isClosed: false });
            open.push(next.key, cost + estimate(next, goal));
        }
    }

    if(nearest === nodes.get(start.key)) { return null; }

    const path = [];

    for(let node = nearest; node.parent; node = node.parent) { path.unshift(centreOf(zone, node)); }

    if(nearest.column === goal[0] && nearest.row === goal[1]) { path[path.length - 1] = { x: to.x, z: to.z, y: path.at(-1).y }; }

    return straighten(zone, { ...from }, path, radius);
}

function nodeAt(zone, x, z, y)
{
    const [column, row] = zone.columnOf(x, z);

    return { column, row, floor: y, key: keyOf(zone, column, row, y) };
}

function keyOf(zone, column, row, floor)
{
    return (Math.round(zone.cellY(floor)) * zone.columns + row) * zone.columns + column;
}

// Octile distance in columns.
function estimate(node, goal)
{
    const dx = Math.abs(node.column - goal[0]);
    const dz = Math.abs(node.row - goal[1]);

    return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
}

function centreOf(zone, node)
{
    return { x: (node.column + 0.5) * CELL - zone.half, z: (node.row + 0.5) * CELL - zone.half, y: node.floor };
}

// A diagonal step needs both columns beside it open.
function neighbours(zone, node, radius)
{
    const found = [];
    const open = new Set();

    for(const [dx, dz, step] of NEIGHBOURS)
    {
        const isDiagonal = dx !== 0 && dz !== 0;

        if(isDiagonal && !(open.has(dx + ",0") && open.has("0," + dz))) { continue; }

        const column = node.column + dx;
        const row = node.row + dz;
        const centre = centreOf(zone, { column, row, floor: node.floor });
        const floor = footing(zone, node.floor, centre.x, centre.z, radius);

        if(floor === null) { continue; }

        open.add(dx + "," + dz);
        found.push({ column, row, floor, step, key: keyOf(zone, column, row, floor) });
    }

    return found;
}

// The floor a cylinder on `feet` reaches at a point, or null.
function footing(zone, feet, x, z, radius)
{
    const stand = zone.footingAt(x, z, feet, radius);

    if(!stand || feet - stand.floor > MAX_DROP || !zone.isClearOfColliders(x, z, radius)) { return null; }

    return stand.floor;
}


/******************************************************************************/
/* STRAIGHTENING                                                              */
/******************************************************************************/

// Drops each point that a straight walk from the last kept point can skip.
function straighten(zone, from, path, radius)
{
    const kept = [];
    let anchor = from;
    let i = 0;

    while(i < path.length)
    {
        let farthest = i;

        for(let j = Math.min(path.length - 1, i + STRAIGHT_LOOKAHEAD); j > i; j--)
        {
            if(isStraight(zone, anchor, path[j], radius))
            {
                farthest = j;
                break;
            }
        }

        kept.push(path[farthest]);
        anchor = path[farthest];
        i = farthest + 1;
    }

    return kept.map((point) => ({ x: point.x, z: point.z }));
}

function isStraight(zone, from, to, radius)
{
    const distance = Math.hypot(to.x - from.x, to.z - from.z);
    const steps = Math.ceil(distance / SAMPLE);
    let feet = from.y;

    for(let step = 1; step <= steps; step++)
    {
        const t = step / steps;
        const floor = footing(zone, feet, from.x + (to.x - from.x) * t, from.z + (to.z - from.z) * t, radius);

        if(floor === null) { return false; }

        feet = floor;
    }

    return true;
}


/******************************************************************************/
/* HEAP                                                                       */
/******************************************************************************/

class Heap
{
    constructor()
    {
        this.items = [];
    }

    get size()
    {
        return this.items.length;
    }

    push(value, priority)
    {
        const items = this.items;

        items.push({ value, priority });

        for(let i = items.length - 1; i > 0;)
        {
            const parent = (i - 1) >> 1;

            if(items[parent].priority <= items[i].priority) { break; }

            [items[parent], items[i]] = [items[i], items[parent]];
            i = parent;
        }
    }

    pop()
    {
        const items = this.items;
        const top = items[0];
        const last = items.pop();

        if(items.length > 0)
        {
            items[0] = last;

            for(let i = 0; ;)
            {
                const left = i * 2 + 1;
                const right = left + 1;
                let smallest = i;

                if(left < items.length && items[left].priority < items[smallest].priority) { smallest = left; }
                if(right < items.length && items[right].priority < items[smallest].priority) { smallest = right; }
                if(smallest === i) { break; }

                [items[smallest], items[i]] = [items[i], items[smallest]];
                i = smallest;
            }
        }

        return top.value;
    }
}
