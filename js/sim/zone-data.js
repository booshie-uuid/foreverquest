import * as RegionCodec from "./region-codec.js";
import { BlockSet } from "./block-set.js";

const EDGE_MARGIN = 2;
const STEP_CELLS = 1;
const CLEARANCE_CELLS = 6;
const EPSILON = 1e-6;
const OPEN_GROUND_REACH = 4;
const CUBES_PER_METRE = 3;
const { CHUNK, REGION } = RegionCodec;


/******************************************************************************/
/* ZONE DATA                                                                  */
/******************************************************************************/

export class ZoneData
{
    static STEP_CELLS = STEP_CELLS;
    static CUBES_PER_METRE = CUBES_PER_METRE;

    // A placement turns its prefab about y by its angle and scales it about
    // the prefab's origin, which stands on the ground under the placement.
    static toWorld(local, placement)
    {
        const { x, y, z, angle, scale } = placement;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const [lx, ly, lz] = local.map((value) => value * scale);

        return [x + (lx * cos + lz * sin), y + ly, z + (-lx * sin + lz * cos)];
    }

    static async load(source, id, blocks)
    {
        const index = await source.json("zones/" + id + "/index.json");
        const regions = await Promise.all(index.regions.map(async (name) => ({ name, ...RegionCodec.decode(await source.inflated("zones/" + id + "/" + name + ".bin")) })));

        return new ZoneData(index, regions, blocks);
    }

    constructor(zone, regions, blocks)
    {
        this.id = zone.id;
        this.name = zone.name;
        this.welcome = zone.welcome ?? [];
        this.blocks = blocks;
        this.columns = zone.columns;
        this.height = zone.height;
        this.base = zone.base;
        this.size = zone.columns / CUBES_PER_METRE;
        this.half = this.size / 2;
        this.waterLevel = (zone.water - zone.base) / CUBES_PER_METRE;
        this.lighting = zone.lighting;
        this.spawn = zone.spawn;
        this.people = zone.people;
        this.chunksWide = zone.columns / CHUNK;
        this.chunksHigh = zone.height / CHUNK;
        this.regionNames = zone.regions;
        this.regions = new Map();
        this.chunks = new Map();
        this.surfaces = new Uint16Array(zone.columns * zone.columns);
        this.grounds = new Uint16Array(zone.columns * zone.columns);
        this.listeners = [];
        this.lightSpots = zone.lights;

        for(const region of regions) { this.addRegion(region); }

    }

    /* REGIONS ****************************************************************/

    onRegion(listener)
    {
        this.listeners.push(listener);

        return () => { this.listeners = this.listeners.filter((entry) => entry !== listener); };
    }

    emitRegion(type, name)
    {
        for(const listener of this.listeners) { listener({ type, name }); }
    }

    hasRegion(name)
    {
        return this.regions.has(name);
    }

    // The cell column at the region's -x, -z corner.
    static regionCorner(name)
    {
        return name.split("-").map((value) => Number(value) * REGION);
    }

    addRegion(region)
    {
        if(this.regions.has(region.name)) { return; }

        const [left, top] = ZoneData.regionCorner(region.name);
        const keys = [];

        for(let z = 0; z < region.depth; z++)
        {
            this.surfaces.set(region.surfaces.subarray(z * region.width, (z + 1) * region.width), (top + z) * this.columns + left);
            this.grounds.set(region.grounds.subarray(z * region.width, (z + 1) * region.width), (top + z) * this.columns + left);
        }

        for(const chunk of region.chunks)
        {
            const key = this.chunkKey(left / CHUNK + chunk.x, chunk.y, top / CHUNK + chunk.z);

            this.chunks.set(key, chunk);
            keys.push(key);
        }

        this.regions.set(region.name, { width: region.width, depth: region.depth, keys });
        this.emitRegion("added", region.name);
    }

    removeRegion(name)
    {
        const region = this.regions.get(name);

        if(!region) { return; }

        const [left, top] = ZoneData.regionCorner(name);

        for(const key of region.keys) { this.chunks.delete(key); }
        for(let z = 0; z < region.depth; z++)
        {
            this.surfaces.fill(0, (top + z) * this.columns + left, (top + z) * this.columns + left + region.width);
            this.grounds.fill(0, (top + z) * this.columns + left, (top + z) * this.columns + left + region.width);
        }

        this.regions.delete(name);
        this.emitRegion("removed", name);
    }

    regionOfColumn(column, row)
    {
        return Math.floor(column / REGION) + "-" + Math.floor(row / REGION);
    }

    isColumnLoaded(column, row)
    {
        return this.regions.has(this.regionOfColumn(column, row));
    }

    isLoaded(x, z)
    {
        return this.isColumnLoaded(...this.columnOf(x, z));
    }

    /* CELLS ******************************************************************/

    chunkKey(x, y, z)
    {
        return (y * this.chunksWide + z) * this.chunksWide + x;
    }

    chunkAt(x, y, z)
    {
        return this.chunks.get(this.chunkKey(x, y, z)) ?? null;
    }

    isCell(x, y, z)
    {
        return x >= 0 && z >= 0 && y >= 0 && x < this.columns && z < this.columns && y < this.height;
    }

    blockAt(x, y, z)
    {
        if(!this.isCell(x, y, z)) { return BlockSet.AIR; }

        const chunk = this.chunkAt(Math.floor(x / CHUNK), Math.floor(y / CHUNK), Math.floor(z / CHUNK));

        if(!chunk) { return BlockSet.AIR; }
        if(chunk.cells === null) { return chunk.uniform; }

        return chunk.cells[((y % CHUNK) * CHUNK + (z % CHUNK)) * CHUNK + (x % CHUNK)];
    }

    isSolid(x, y, z)
    {
        return this.blocks.isSolid(this.blockAt(x, y, z));
    }

    // The top solid cell + 1, or 0 for an empty column.
    surface(column, row)
    {
        const x = Math.max(0, Math.min(this.columns - 1, column));
        const z = Math.max(0, Math.min(this.columns - 1, row));

        return this.surfaces[z * this.columns + x];
    }

    /* METRES *****************************************************************/

    columnOf(x, z)
    {
        return [Math.floor((x + this.half) * CUBES_PER_METRE), Math.floor((z + this.half) * CUBES_PER_METRE)];
    }

    heightAt(x, z)
    {
        return (this.surface(...this.columnOf(x, z)) - this.base) / CUBES_PER_METRE;
    }

    // The height of the terrain under any props.
    groundAt(x, z)
    {
        const [column, row] = this.columnOf(x, z);
        const clamp = (value) => Math.max(0, Math.min(this.columns - 1, value));

        return (this.grounds[clamp(row) * this.columns + clamp(column)] - this.base) / CUBES_PER_METRE;
    }

    typeAt(x, z)
    {
        const [column, row] = this.columnOf(x, z);

        return this.blocks.block(this.blockAt(column, this.surface(column, row) - 1, row))?.id ?? "air";
    }

    isWater(x, z)
    {
        const [column, row] = this.columnOf(x, z);

        return this.blocks.isLiquid(this.blockAt(column, this.surface(column, row), row));
    }

    isInside(x, z, margin = 0)
    {
        return Math.abs(x) < this.half - margin && Math.abs(z) < this.half - margin;
    }

    /* MOVEMENT ***************************************************************/

    cellY(metres)
    {
        return metres * CUBES_PER_METRE + this.base;
    }

    metresY(cells)
    {
        return (cells - this.base) / CUBES_PER_METRE;
    }

    isWalkable(x, z)
    {
        return this.isInside(x, z, EDGE_MARGIN) && this.isLoaded(x, z);
    }

    // A cylinder stands on the highest solid cell under it that is no more
    // than a step above its feet, and is blocked when a solid cell reaches
    // into the CLEARANCE cells above that floor.
    standAt(x, z, feet, radius)
    {
        const reach = Math.floor(this.cellY(feet) + STEP_CELLS + EPSILON);
        const [left, back] = this.columnOf(x - radius, z - radius);
        const [right, front] = this.columnOf(x + radius, z + radius);
        const touched = [];
        let floor = 0;

        for(let row = back; row <= front; row++)
        {
            for(let column = left; column <= right; column++)
            {
                if(!this.touches(column, row, x, z, radius)) { continue; }

                touched.push([column, row]);
                floor = Math.max(floor, this.topBelow(column, row, reach));
            }
        }

        const isBlocked = touched.some(([column, row]) =>
        {
            for(let y = floor; y < floor + CLEARANCE_CELLS; y++) { if(this.isSolid(column, y, row)) { return true; } }

            return false;
        });
        const [column, row] = this.columnOf(x, z);

        return { floor: this.metresY(floor), isBlocked, isWet: this.blocks.isLiquid(this.blockAt(column, floor, row)) };
    }

    // The nearest point to (x, z), within OPEN_GROUND_REACH, where a cylinder
    // stands on the terrain itself rather than on a prop. Unloaded ground
    // gives back the point.
    openGround(x, z, radius)
    {
        const [column, row] = this.columnOf(x, z);
        const reach = Math.ceil(OPEN_GROUND_REACH * CUBES_PER_METRE);
        const offsets = [];

        for(let dz = -reach; dz <= reach; dz++) { for(let dx = -reach; dx <= reach; dx++) { offsets.push([dx, dz]); } }

        offsets.sort((a, b) => Math.hypot(...a) - Math.hypot(...b));

        for(const [dx, dz] of offsets)
        {
            const spot = dx === 0 && dz === 0 ? { x, z } : { x: (column + dx + 0.5) / CUBES_PER_METRE - this.half, z: (row + dz + 0.5) / CUBES_PER_METRE - this.half };
            const ground = this.groundAt(spot.x, spot.z);
            const footing = this.footingAt(spot.x, spot.z, ground, radius);

            if(footing && Math.abs(footing.floor - ground) < EPSILON) { return { x: spot.x, y: ground, z: spot.z }; }
        }

        return { x, y: this.groundAt(x, z), z };
    }

    // An entity placed before its ground loaded can end up inside it; this
    // returns the top of the solid cells around its feet, or its feet.
    liftOut(x, z, feet)
    {
        const [column, row] = this.columnOf(x, z);
        let y = Math.floor(this.cellY(feet) + EPSILON);

        if(!this.isSolid(column, y, row)) { return feet; }

        while(this.isSolid(column, y, row)) { y++; }

        return this.metresY(y);
    }

    // How far, in metres, a ray from `origin` along the unit `direction`
    // travels before it enters a solid cell, up to `distance`.
    // Amanatides and Woo, "A Fast Voxel Traversal Algorithm for Ray Tracing".
    raycast(origin, direction, distance)
    {
        const start = [(origin.x + this.half) * CUBES_PER_METRE, this.cellY(origin.y), (origin.z + this.half) * CUBES_PER_METRE];
        const along = [direction.x, direction.y, direction.z].map((value) => value * CUBES_PER_METRE);
        const cell = start.map(Math.floor);
        const step = along.map(Math.sign);
        const across = along.map((value) => (value === 0 ? Infinity : 1 / Math.abs(value)));
        const next = [0, 1, 2].map((axis) => (along[axis] === 0 ? Infinity : (step[axis] > 0 ? cell[axis] + 1 - start[axis] : start[axis] - cell[axis]) * across[axis]));

        if(this.isSolid(...cell)) { return 0; }

        for(;;)
        {
            const axis = next[0] < next[1] ? (next[0] < next[2] ? 0 : 2) : (next[1] < next[2] ? 1 : 2);
            const travelled = next[axis];

            if(travelled > distance) { return distance; }

            cell[axis] += step[axis];
            next[axis] += across[axis];

            if(this.isSolid(...cell)) { return travelled; }
        }
    }

    // Whether a circle overlaps a column's square.
    touches(column, row, x, z, radius)
    {
        const left = column / CUBES_PER_METRE - this.half;
        const back = row / CUBES_PER_METRE - this.half;
        const nearestX = Math.max(left, Math.min(x, left + 1 / CUBES_PER_METRE));
        const nearestZ = Math.max(back, Math.min(z, back + 1 / CUBES_PER_METRE));

        return Math.hypot(x - nearestX, z - nearestZ) < radius;
    }

    // The top of the highest solid cell in a column whose top is at or below
    // `limit`, or 0.
    topBelow(column, row, limit)
    {
        const surface = this.surface(column, row);

        if(surface <= limit) { return surface; }

        for(let y = limit - 1; y >= 0; y--) { if(this.isSolid(column, y, row)) { return y + 1; } }

        return 0;
    }

    // Null where a cylinder whose feet are at `feet` cannot stand.
    footingAt(x, z, feet, radius)
    {
        if(!this.isWalkable(x, z)) { return null; }

        const stand = this.standAt(x, z, feet, radius);

        return stand.isBlocked || stand.isWet ? null : stand;
    }

    resolveMove(from, to, radius)
    {
        const candidates = [to, { x: to.x, z: from.z }, { x: from.x, z: to.z }];

        for(const candidate of candidates)
        {
            const footing = this.footingAt(candidate.x, candidate.z, from.y, radius);

            if(footing) { return { x: candidate.x, z: candidate.z, floor: footing.floor }; }
        }

        return { x: from.x, z: from.z, floor: this.standAt(from.x, from.z, from.y, radius).floor };
    }
}
