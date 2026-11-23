import * as PropBlocks from "../../content/props/blocks.js";
import { ZoneData } from "../../js/sim/zone-data.js";

const CUBES = ZoneData.CUBES_PER_METRE;
const CELL = 1 / CUBES;
const QUARTER = Math.PI / 2;
const EPSILON = 1e-9;


/******************************************************************************/
/* PLACEMENTS                                                                 */
/******************************************************************************/

export function quarterTurn(angle)
{
    return Math.round(angle / QUARTER) * QUARTER;
}

// The cells of every placed prefab and run, as a map from cell index,
// (y * columns + z) * columns + x, to block number.
export function zoneCells(zone, props, runs, prefabs, numbers, where, problems)
{
    const cells = new Map();
    const lights = [];

    for(const prop of props)
    {
        const placement = { x: prop.x, y: prop.y, z: prop.z, angle: quarterTurn(prop.angle ?? 0), scale: prop.scale ?? 1 };
        const prefab = prefabs[prop.prefab];

        for(const block of prefab.blocks) { rasterise(cells, zone, worldBlock(block, placement), blockOf(block, numbers, where + " prefab " + prop.prefab, problems)); }

        lights.push(...prefab.lights.map((light) => ZoneData.toWorld(light, placement)));
    }

    for(const run of runs)
    {
        for(const block of run.blocks) { rasterise(cells, zone, block, blockOf(block, numbers, where + " run", problems)); }
    }

    return { cells, lights };
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

// Each side of a block counts as at least one cell thick.
export function rasterise(cells, zone, block, number)
{
    if(number === 0) { return; }

    const matrix = rotationOf(block.rotation ?? [0, 0, 0]);
    const halves = block.size.map((value) => Math.max(value / 2, CELL / 2));
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

                if(isInside) { cells.set((y * zone.columns + z) * zone.columns + x, number); }
            }
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
