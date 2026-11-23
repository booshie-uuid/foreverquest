import * as Png from "../../js/engine/png.js";
import * as RegionCodec from "../../js/sim/region-codec.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";
import * as zlib from "node:zlib";
import { ZoneData } from "../../js/sim/zone-data.js";

export const CUBES_PER_METRE = ZoneData.CUBES_PER_METRE;

const { CHUNK, CELLS, REGION } = RegionCodec;
const UNDER_DEPTH = 3;
const CLIFF_DROP = 4;
const HIGH_GROUND = 12;
const NEIGHBOURS = [[1, 0], [-1, 0], [0, 1], [0, -1]];


/******************************************************************************/
/* TERRAIN LAYER                                                              */
/******************************************************************************/

export function regionNames(columns)
{
    const names = [];
    const count = Math.ceil(columns / REGION);

    for(let rz = 0; rz < count; rz++)
    {
        for(let rx = 0; rx < count; rx++) { names.push(rx + "-" + rz); }
    }

    return names;
}

// A zone's terrain is a script whose `column(zone, x, z)` returns a
// column's [surface, ground], or one image per region with a column's surface
// in red and its ground index in green.
export async function readColumns(folder, zone, where, problems)
{
    const columns = zone.columns;
    const surfaces = new Uint16Array(columns * columns);
    const grounds = new Uint8Array(columns * columns);
    const script = path.join(folder, "terrain.js");

    if(fs.existsSync(script))
    {
        const { column } = await import(url.pathToFileURL(script).href);

        for(let z = 0; z < columns; z++)
        {
            for(let x = 0; x < columns; x++) { [surfaces[z * columns + x], grounds[z * columns + x]] = column(zone, x, z); }
        }
    }
    else
    {
        await readImages(folder, zone, { surfaces, grounds }, where, problems);
    }

    for(let i = 0; i < surfaces.length; i++)
    {
        if(surfaces[i] > zone.height) { problems.push(where + " has a column taller than its height of " + zone.height + " cells"); break; }
        if(grounds[i] >= zone.ground.length) { problems.push(where + " has a column with ground " + grounds[i] + ", which its ground list does not have"); break; }
    }

    return { surfaces, grounds };
}

async function readImages(folder, zone, { surfaces, grounds }, where, problems)
{
    const columns = zone.columns;

    for(const name of regionNames(columns))
    {
        const [rx, rz] = name.split("-").map(Number);
        const file = path.join(folder, "terrain", name + ".png");
        const width = Math.min(REGION, columns - rx * REGION);
        const depth = Math.min(REGION, columns - rz * REGION);

        if(!fs.existsSync(file)) { problems.push(where + " has no terrain image terrain/" + name + ".png"); continue; }

        const image = await Png.decode(new Uint8Array(fs.readFileSync(file)));

        if(image.width !== width || image.height !== depth) { problems.push(where + " terrain/" + name + ".png is " + image.width + " by " + image.height + ", not " + width + " by " + depth); continue; }

        for(let z = 0; z < depth; z++)
        {
            for(let x = 0; x < width; x++)
            {
                const from = (z * width + x) * 4;
                const to = (rz * REGION + z) * columns + rx * REGION + x;

                surfaces[to] = image.data[from];
                grounds[to] = image.data[from + 1];
            }
        }
    }
}

export function heightsOf(zone, surfaces)
{
    const half = zone.columns / CUBES_PER_METRE / 2;

    return (x, z) =>
    {
        const column = Math.max(0, Math.min(zone.columns - 1, Math.floor((x + half) * CUBES_PER_METRE)));
        const row = Math.max(0, Math.min(zone.columns - 1, Math.floor((z + half) * CUBES_PER_METRE)));

        return (surfaces[row * zone.columns + column] - zone.base) / CUBES_PER_METRE;
    };
}


/******************************************************************************/
/* REGIONS                                                                    */
/******************************************************************************/

// `ground` holds the { top, under } block numbers of each ground index.
export function bakeRegions(zone, terrain, ground, blocks)
{
    return regionNames(zone.columns).map((name) =>
    {
        const [rx, rz] = name.split("-").map(Number);
        const region = composeRegion(zone, terrain, ground, blocks, rx, rz);

        return { name, bytes: zlib.deflateSync(RegionCodec.encode(region), { level: 9 }) };
    });
}

export function composeRegion(zone, terrain, ground, blocks, rx, rz)
{
    const columns = zone.columns;
    const width = Math.min(REGION, columns - rx * REGION);
    const depth = Math.min(REGION, columns - rz * REGION);
    const [wide, deep, high] = [Math.ceil(width / CHUNK), Math.ceil(depth / CHUNK), zone.height / CHUNK];
    const grid = new Array(wide * deep * high).fill(null);
    const surfaces = new Uint16Array(width * depth);

    const cellsOf = (cx, cy, cz) =>
    {
        const index = (cy * deep + cz) * wide + cx;

        grid[index] ??= new Uint8Array(CELLS);

        return grid[index];
    };

    for(let z = 0; z < depth; z++)
    {
        for(let x = 0; x < width; x++)
        {
            const column = rx * REGION + x;
            const row = rz * REGION + z;
            const surface = terrain.surfaces[row * columns + column];
            const layers = ground[terrain.grounds[row * columns + column]];
            const under = isRocky(zone, terrain.surfaces, column, row) ? blocks.rock : layers.under;
            const top = Math.max(surface, zone.water);
            const offset = (z % CHUNK) * CHUNK + (x % CHUNK);

            surfaces[z * width + x] = surface;

            for(let cy = 0; cy * CHUNK < top; cy++)
            {
                const cells = cellsOf(Math.floor(x / CHUNK), cy, Math.floor(z / CHUNK));

                for(let y = cy * CHUNK; y < Math.min(top, (cy + 1) * CHUNK); y++)
                {
                    const below = surface - 1 - y;
                    let block = blocks.water;

                    if(below > UNDER_DEPTH) { block = blocks.rock; }
                    else if(below > 0) { block = under; }
                    else if(below === 0) { block = layers.top; }

                    cells[(y - cy * CHUNK) * CHUNK * CHUNK + offset] = block;
                }
            }
        }
    }

    const chunks = [];

    grid.forEach((cells, index) =>
    {
        if(cells) { chunks.push({ x: index % wide, y: Math.floor(index / (wide * deep)), z: Math.floor(index / wide) % deep, cells }); }
    });

    return { width, depth, height: zone.height, surfaces, chunks };
}

function isRocky(zone, surfaces, column, row)
{
    const surface = surfaces[row * zone.columns + column];

    if(surface - zone.base >= HIGH_GROUND) { return true; }

    return NEIGHBOURS.some(([dx, dz]) =>
    {
        const x = column + dx;
        const z = row + dz;

        if(x < 0 || z < 0 || x >= zone.columns || z >= zone.columns) { return false; }

        return surface - surfaces[z * zone.columns + x] > CLIFF_DROP;
    });
}
