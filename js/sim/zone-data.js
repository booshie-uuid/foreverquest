import * as RegionCodec from "./region-codec.js";
import { BlockSet } from "./block-set.js";

const EDGE_MARGIN = 2;
const STEP_CELLS = 1;
const CLEARANCE_CELLS = 6;
const EPSILON = 1e-6;
const CELL = 4;
const CUBES_PER_METRE = 3;
const { CHUNK, REGION } = RegionCodec;


/******************************************************************************/
/* PLACEMENT                                                                  */
/******************************************************************************/

function placeCollider(collider, placement)
{
    const [x, , z] = ZoneData.toWorld([collider.x, 0, collider.z], placement);

    if(collider.radius !== undefined) { return { x, z, radius: collider.radius * placement.scale }; }

    return { x, z, halfWidth: collider.halfWidth * placement.scale, halfDepth: collider.halfDepth * placement.scale, angle: collider.angle + placement.angle };
}

function extentOf(collider)
{
    return collider.radius ?? Math.hypot(collider.halfWidth, collider.halfDepth);
}


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

    static async load(source, id, prefabs, blocks)
    {
        const index = await source.json("zones/" + id + "/index.json");
        const regions = await Promise.all(index.regions.map(async (name) => ({ name, ...RegionCodec.decode(await source.inflated("zones/" + id + "/" + name + ".bin")) })));

        return new ZoneData(index, regions, prefabs, blocks);
    }

    constructor(zone, regions, prefabs, blocks)
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
        this.runs = zone.runs;
        this.chunksWide = zone.columns / CHUNK;
        this.chunksHigh = zone.height / CHUNK;
        this.regionNames = zone.regions;
        this.regions = new Map();
        this.chunks = new Map();
        this.surfaces = new Uint16Array(zone.columns * zone.columns);
        this.listeners = [];
        this.placements = [];
        this.colliders = [];
        this.lightSpots = [];

        for(const region of regions) { this.addRegion(region); }

        this.place(zone.props, prefabs);
        this.grid = this.buildGrid();
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
        for(let z = 0; z < region.depth; z++) { this.surfaces.fill(0, (top + z) * this.columns + left, (top + z) * this.columns + left + region.width); }

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

    place(props, prefabs)
    {
        for(const prop of props)
        {
            if(prop.run !== undefined)
            {
                this.placements.push({ run: prop.run });
                this.colliders.push(...this.runs[prop.run].colliders);
                continue;
            }

            const prefab = prefabs[prop.prefab];
            const placement = { prefab: prop.prefab, x: prop.x, y: prop.y, z: prop.z, angle: prop.angle ?? 0, scale: prop.scale ?? 1 };

            this.placements.push(placement);
            this.colliders.push(...prefab.colliders.map((collider) => placeCollider(collider, placement)));
            this.lightSpots.push(...prefab.lights.map((light) => ZoneData.toWorld(light, placement)));
        }
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

    isClearOfColliders(x, z, radius)
    {
        const pushed = this.pushOut({ x, z }, radius);

        return Math.hypot(pushed.x - x, pushed.z - z) < 1e-9;
    }

    resolveMove(from, to, radius)
    {
        const pushed = this.pushOut(to, radius);
        const candidates = [pushed, { x: pushed.x, z: from.z }, { x: from.x, z: pushed.z }];

        for(const [i, candidate] of candidates.entries())
        {
            if(i > 0 && !this.isClearOfColliders(candidate.x, candidate.z, radius)) { continue; }

            const footing = this.footingAt(candidate.x, candidate.z, from.y, radius);

            if(footing) { return { x: candidate.x, z: candidate.z, floor: footing.floor }; }
        }

        return { x: from.x, z: from.z, floor: this.standAt(from.x, from.z, from.y, radius).floor };
    }

    // Pushes the circle out of each nearby collider in turn, twice over, as
    // if it had tested every collider in the zone.
    pushOut(point, radius)
    {
        const result = { x: point.x, z: point.z };
        const nearby = this.collidersNear(point.x, point.z, 2 * this.maxExtent + 2 * radius);

        for(let pass = 0; pass < 2; pass++)
        {
            for(const collider of nearby)
            {
                if(collider.radius !== undefined) { ZoneData.pushOutOfCircle(result, collider, radius); }
                else { ZoneData.pushOutOfBox(result, collider, radius); }
            }
        }

        return result;
    }

    static pushOutOfCircle(point, circle, radius)
    {
        const dx = point.x - circle.x;
        const dz = point.z - circle.z;
        const distance = Math.hypot(dx, dz);
        const minimum = circle.radius + radius;

        if(distance >= minimum || distance === 0) { return; }

        point.x = circle.x + (dx / distance) * minimum;
        point.z = circle.z + (dz / distance) * minimum;
    }

    static pushOutOfBox(point, box, radius)
    {
        const cos = Math.cos(box.angle);
        const sin = Math.sin(box.angle);
        const dx = point.x - box.x;
        const dz = point.z - box.z;
        const localX = dx * cos - dz * sin;
        const localZ = dx * sin + dz * cos;
        const halfWidth = box.halfWidth + radius;
        const halfDepth = box.halfDepth + radius;

        if(Math.abs(localX) >= halfWidth || Math.abs(localZ) >= halfDepth) { return; }

        const pushX = halfWidth - Math.abs(localX);
        const pushZ = halfDepth - Math.abs(localZ);
        let newX = localX;
        let newZ = localZ;

        if(pushX < pushZ)
        {
            newX = Math.sign(localX || 1) * halfWidth;
        }
        else
        {
            newZ = Math.sign(localZ || 1) * halfDepth;
        }

        point.x = box.x + newX * cos + newZ * sin;
        point.z = box.z - newX * sin + newZ * cos;
    }

    /* GRID *******************************************************************/

    buildGrid()
    {
        const cells = new Map();

        this.maxExtent = 0;

        this.colliders.forEach((collider, index) =>
        {
            const extent = extentOf(collider);

            this.maxExtent = Math.max(this.maxExtent, extent);

            for(const key of this.cellsAround(collider.x, collider.z, extent))
            {
                if(!cells.has(key)) { cells.set(key, []); }

                cells.get(key).push(index);
            }
        });

        return cells;
    }

    cellsAround(x, z, reach)
    {
        const keys = [];
        const [left, top] = [Math.floor((x - reach + this.half) / CELL), Math.floor((z - reach + this.half) / CELL)];
        const [right, bottom] = [Math.floor((x + reach + this.half) / CELL), Math.floor((z + reach + this.half) / CELL)];

        for(let row = top; row <= bottom; row++)
        {
            for(let column = left; column <= right; column++) { keys.push(column + "," + row); }
        }

        return keys;
    }

    // In the zone's order, so pushes apply in the same order as a full scan.
    collidersNear(x, z, reach)
    {
        const indices = new Set();

        for(const key of this.cellsAround(x, z, reach))
        {
            for(const index of this.grid.get(key) ?? []) { indices.add(index); }
        }

        return [...indices].sort((a, b) => a - b).map((index) => this.colliders[index]);
    }
}
