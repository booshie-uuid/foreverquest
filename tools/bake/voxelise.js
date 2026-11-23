import * as PropBlocks from "../../content/props/blocks.js";
import { ZoneData } from "../../js/sim/zone-data.js";

const CUBES = ZoneData.CUBES_PER_METRE;
const CELL = 1 / CUBES;
const QUARTER = Math.PI / 2;
const EPSILON = 1e-9;
const CLEARANCE = 6;


/******************************************************************************/
/* PLACEMENTS                                                                 */
/******************************************************************************/

export function quarterTurn(angle)
{
    return Math.round(angle / QUARTER) * QUARTER;
}

// A prefab's doors face along local +z.
export function standingHeight(prop, prefab, heightAt)
{
    const door = prefab.doors?.[0];

    if(!door) { return heightAt(prop.x, prop.z); }

    const scale = prop.scale ?? 1;
    const placement = { x: Math.round(prop.x * CUBES) / CUBES, y: 0, z: Math.round(prop.z * CUBES) / CUBES, angle: quarterTurn(prop.angle ?? 0), scale };
    const [x, , z] = ZoneData.toWorld([door.at[0], 0, door.at[2] + door.size[2] / 2 + CELL / 2], placement);
    const sill = Math.round((door.at[1] - door.size[1] / 2) * scale * CUBES) / CUBES;

    return heightAt(x, z) - sill;
}

// Placements stand on a cube corner and turn in quarter turns.
// The cells of every placed prefab and run, as a map from cell index,
// (y * columns + z) * columns + x, to block number, where 0 carves air out
// of the terrain, and each object's prop number and box of cells.
// `groundOf(column, row)` gives the terrain's surface.
export function zoneCells(zone, props, runs, prefabs, numbers, where, problems, groundOf)
{
    const cells = new Map();
    const objects = [];

    for(const prop of props)
    {
        const placement = { x: Math.round(prop.x * CUBES) / CUBES, y: prop.y, z: Math.round(prop.z * CUBES) / CUBES, angle: quarterTurn(prop.angle ?? 0), scale: prop.scale ?? 1 };
        const prefab = prefabs[prop.prefab];
        const box = new Box();

        for(const block of prefab.blocks) { box.add(rasterise(cells, zone, worldBlock(block, placement), blockOf(block, numbers, where + " prefab " + prop.prefab, problems))); }

        objects.push({ prop: prop.index, name: prop.prefab, x: placement.x, z: placement.z, turns: Math.round(placement.angle / QUARTER), box: box.cells });

        const carved = new Map();

        for(const room of prefab.rooms ?? []) { carve(cells, zone, worldBlock(room, placement), carved); }

        keepShell(cells, zone, carved, groundOf);

        for(const door of prefab.doors ?? [])
        {
            carve(cells, zone, worldBlock(door, placement));
            addSteps(cells, zone, worldBlock(door, placement), placement.angle, groundOf, numbers[PropBlocks.STEP]);
        }
    }

    for(const run of runs)
    {
        const box = new Box();

        for(const block of run.blocks) { box.add(rasterise(cells, zone, block, blockOf(block, numbers, where + " run", problems))); }

        objects.push({ prop: run.index, name: "run " + run.name, x: run.points[0][0], z: run.points[0][1], turns: 0, box: box.cells });
    }

    return { cells, objects };
}

function worldBlock(block, placement)
{
    const [rx, ry, rz] = block.rotation ?? [0, 0, 0];

    return {
        size: block.size.map((value) => value * placement.scale),
        at: ZoneData.toWorld(block.at, placement),
        rotation: [rx, ry + placement.angle, rz],
    };
}

function blockOf(block, numbers, where, problems)
{
    const texture = block.faces.front ?? block.faces.top ?? Object.values(block.faces).find(Boolean);
    const id = PropBlocks.BLOCK_FOR_TEXTURE[texture];

    if(!id || !numbers[id])
    {
        problems.push(where + " paints " + texture + ", which has no block type");

        return 0;
    }

    return numbers[id];
}


/******************************************************************************/
/* RASTER                                                                     */
/******************************************************************************/

// Each side of a block counts as at least one cell thick, unless it carves.
// When carving, `carved` gathers each carved cell's block before it.
export function rasterise(cells, zone, block, number, isCarving = false, carved = null)
{
    if(number === 0 && !isCarving) { return null; }

    const matrix = rotationOf(block.rotation ?? [0, 0, 0]);
    const halves = block.size.map((value) => (isCarving ? value / 2 : Math.max(value / 2, CELL / 2)));
    const reach = [0, 1, 2].map((row) => matrix[row].reduce((total, value, column) => total + Math.abs(value) * halves[column], 0));
    const half = zone.columns / CUBES / 2;
    const toCell = [(metres) => (metres + half) * CUBES, (metres) => metres * CUBES + zone.base, (metres) => (metres + half) * CUBES];
    const low = [0, 1, 2].map((axis) => Math.max(0, Math.floor(toCell[axis](block.at[axis] - reach[axis]))));
    const high = [0, 1, 2].map((axis) => Math.min(axis === 1 ? zone.height - 1 : zone.columns - 1, Math.floor(toCell[axis](block.at[axis] + reach[axis]))));

    for(let y = low[1]; y <= high[1]; y++)
    {
        for(let z = low[2]; z <= high[2]; z++)
        {
            for(let x = low[0]; x <= high[0]; x++)
            {
                const offset = [(x + 0.5) / CUBES - half - block.at[0], (y + 0.5 - zone.base) / CUBES - block.at[1], (z + 0.5) / CUBES - half - block.at[2]];
                const isInside = [0, 1, 2].every((axis) => Math.abs(matrix[0][axis] * offset[0] + matrix[1][axis] * offset[1] + matrix[2][axis] * offset[2]) <= halves[axis] + EPSILON);

                if(!isInside) { continue; }

                const index = (y * zone.columns + z) * zone.columns + x;

                if(carved && !carved.has(index)) { carved.set(index, cells.get(index) ?? null); }

                cells.set(index, number);
            }
        }
    }

    return { low, high };
}

// The cells an object's blocks reach, as [x0, y0, z0, x1, y1, z1], inclusive.
class Box
{
    constructor()
    {
        this.cells = null;
    }

    add(range)
    {
        if(!range) { return; }

        const next = [...range.low, ...range.high];

        this.cells = this.cells ? this.cells.map((value, i) => (i < 3 ? Math.min(value, next[i]) : Math.max(value, next[i]))) : next;
    }
}

// An object's `x` and `z` give the middle of its footprint.
export function placeObjects(cells, zone, placements, objects, objectBlock)
{
    const half = zone.columns / CUBES / 2;

    return placements.map((placement) =>
    {
        const object = objects[placement.object];
        const turns = ((Math.round((placement.angle ?? 0) / QUARTER) % 4) + 4) % 4;
        const [width, height, depth] = object.cells;
        const [across, along] = turns % 2 === 0 ? [width, depth] : [depth, width];
        const column = Math.round((placement.x + half) * CUBES - across / 2);
        const row = Math.round((placement.z + half) * CUBES - along / 2);
        const floor = Math.round(placement.y * CUBES + zone.base);

        if(object.isSolid)
        {
            for(let y = floor; y < floor + height; y++)
            {
                for(let z = row; z < row + along; z++)
                {
                    for(let x = column; x < column + across; x++) { cells.set((y * zone.columns + z) * zone.columns + x, objectBlock); }
                }
            }
        }

        return {
            prop: placement.index,
            name: "object " + placement.object,
            object: placement.object,
            x: (column + across / 2) / CUBES - half,
            y: (floor - zone.base) / CUBES,
            z: (row + along / 2) / CUBES - half,
            turns,
            box: [column, floor, row, column + across - 1, floor + height - 1, row + along - 1],
        };
    });
}

export function carve(cells, zone, box, carved = null)
{
    rasterise(cells, zone, box, 0, true, carved);
}

// A room carved through a wall or roof thinner than a cube would open onto
// the outside, even across a corner, so each carved cell beside, diagonally
// beside or below outside air gets its block back and becomes the wall.
export function keepShell(cells, zone, carved, groundOf)
{
    const columns = zone.columns;
    const isOutsideAir = (index) =>
    {
        if(carved.has(index)) { return false; }

        const block = cells.get(index);
        const x = index % columns;
        const z = Math.floor(index / columns) % columns;
        const y = Math.floor(index / (columns * columns));

        return block === 0 || (block === undefined && y >= groundOf(x, z));
    };

    for(const [index, previous] of carved)
    {
        if(!previous) { continue; }

        const x = index % columns;
        const z = Math.floor(index / columns) % columns;
        const neighbours = [index + columns * columns];

        for(let dz = -1; dz <= 1; dz++)
        {
            for(let dx = -1; dx <= 1; dx++)
            {
                const isInside = x + dx >= 0 && x + dx < columns && z + dz >= 0 && z + dz < columns;

                if((dx !== 0 || dz !== 0) && isInside) { neighbours.push(index + dz * columns + dx); }
            }
        }

        if(neighbours.some(isOutsideAir)) { cells.set(index, previous); }
    }
}

export function addSteps(cells, zone, door, angle, groundOf, step)
{
    const half = zone.columns / CUBES / 2;
    const facing = [Math.round(Math.sin(angle)), Math.round(Math.cos(angle))];
    const across = [facing[1], -facing[0]];
    const sill = Math.round((door.at[1] - door.size[1] / 2) * CUBES + zone.base);
    const front = [door.at[0] + facing[0] * door.size[2] / 2, door.at[2] + facing[1] * door.size[2] / 2];
    const width = door.size[0];

    for(let offset = -width / 2 + CELL / 2; offset < width / 2; offset += CELL)
    {
        for(let k = 1; sill - k > 0; k++)
        {
            const x = front[0] + facing[0] * (k - 0.5) * CELL + across[0] * offset;
            const z = front[1] + facing[1] * (k - 0.5) * CELL + across[1] * offset;
            const column = Math.floor((x + half) * CUBES);
            const row = Math.floor((z + half) * CUBES);
            const top = sill - k;

            if(column < 0 || row < 0 || column >= zone.columns || row >= zone.columns || top <= groundOf(column, row)) { break; }

            for(let y = groundOf(column, row); y < top; y++) { cells.set((y * zone.columns + row) * zone.columns + column, step); }
            for(let y = top; y < top + CLEARANCE; y++) { cells.set((y * zone.columns + row) * zone.columns + column, 0); }
        }
    }
}

// The rotation that Three.js builds from Euler angles in YXZ order, as rows.
function rotationOf([x, y, z])
{
    const turnY = [[Math.cos(y), 0, Math.sin(y)], [0, 1, 0], [-Math.sin(y), 0, Math.cos(y)]];
    const turnX = [[1, 0, 0], [0, Math.cos(x), -Math.sin(x)], [0, Math.sin(x), Math.cos(x)]];
    const turnZ = [[Math.cos(z), -Math.sin(z), 0], [Math.sin(z), Math.cos(z), 0], [0, 0, 1]];

    return multiply(multiply(turnY, turnX), turnZ);
}

function multiply(a, b)
{
    return a.map((row) => [0, 1, 2].map((column) => row.reduce((total, value, k) => total + value * b[k][column], 0)));
}
