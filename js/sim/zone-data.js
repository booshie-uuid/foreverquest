import * as RegionCodec from "./region-codec.js";
import { BlockSet } from "./block-set.js";

const EDGE_MARGIN = 2;
const STEP_CELLS = 1;
const CLEARANCE_CELLS = 7;
const EPSILON = 1e-6;
const OPEN_GROUND_REACH = 4;
const CUBES_PER_METRE = 3;
const COARSE = 2;
const { CHUNK, REGION } = RegionCodec;
const COARSE_CHUNK = CHUNK / COARSE;
const GLOW_EXIT_STEPS = 4;
const GLOW_EXIT_KEEP = 0.9;
const AROUND = [-1, 0, 1].flatMap((dx) => [-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dz) => [dx, dy, dz])));


/******************************************************************************/
/* ZONE DATA                                                                  */
/******************************************************************************/

export class ZoneData
{
    static STEP_CELLS = STEP_CELLS;
    static CUBES_PER_METRE = CUBES_PER_METRE;
    static COARSE = COARSE;

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
        this.objects = zone.objects ?? [];
        this.chunksWide = zone.columns / CHUNK;
        this.chunksHigh = zone.height / CHUNK;
        this.regionNames = zone.regions;
        this.regions = new Map();
        this.chunks = new Map();
        this.surfaces = new Uint16Array(zone.columns * zone.columns);
        this.grounds = new Uint16Array(zone.columns * zone.columns);
        this.ages = new Uint8Array(zone.columns * zone.columns);
        this.moving = new Map();
        this.movingColumns = new Map();
        this.coarse = new Map();
        this.listeners = [];

        for(const region of regions) { this.addRegion(region); }

    }

    /* REGIONS ****************************************************************/

    onRegion(listener)
    {
        this.listeners.push(listener);

        return () => { this.listeners = this.listeners.filter((entry) => entry !== listener); };
    }

    // `cells` lists the [x, y, z] cells of a "cells" change.
    emitRegion(type, name, cells = null)
    {
        for(const listener of this.listeners) { listener({ type, name, cells }); }
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

        this.storeRegion(region);
        this.forgetCoarse(region.name);
        this.emitRegion("added", region.name);
    }

    storeRegion(region)
    {
        const [left, top] = ZoneData.regionCorner(region.name);
        const keys = [];

        for(let z = 0; z < region.depth; z++)
        {
            this.surfaces.set(region.surfaces.subarray(z * region.width, (z + 1) * region.width), (top + z) * this.columns + left);
            this.grounds.set(region.grounds.subarray(z * region.width, (z + 1) * region.width), (top + z) * this.columns + left);
            this.ages.set((region.ages ?? new Uint8Array(region.width * region.depth)).subarray(z * region.width, (z + 1) * region.width), (top + z) * this.columns + left);
        }

        for(const chunk of region.chunks)
        {
            const key = this.chunkKey(left / CHUNK + chunk.x, chunk.y, top / CHUNK + chunk.z);

            this.chunks.set(key, chunk);
            keys.push(key);
        }

        this.regions.set(region.name, { width: region.width, depth: region.depth, keys });
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
            this.ages.fill(0, (top + z) * this.columns + left, (top + z) * this.columns + left + region.width);
        }

        this.regions.delete(name);
        this.forgetCoarse(name);
        this.emitRegion("removed", name);
    }

    // A region the editor baked again replaces the loaded one in place.
    replaceRegion(region)
    {
        const old = this.regions.get(region.name);

        if(!old) { return; }

        for(const key of old.keys) { this.chunks.delete(key); }

        this.regions.delete(region.name);
        this.storeRegion(region);
        this.forgetCoarse(region.name);
        this.emitRegion("replaced", region.name);
    }

    setObjects(objects)
    {
        this.objects = objects;
        this.emitRegion("objects", null);
    }

    // Sets [x, y, z, block] cells in loaded regions, as the editor shows a
    // change before the server bakes it, and returns the cells set.
    setCells(cells)
    {
        const set = [];

        for(const [x, y, z, block] of cells)
        {
            if(!this.isCell(x, y, z) || !this.isColumnLoaded(x, z)) { continue; }

            const [cx, cy, cz] = [Math.floor(x / CHUNK), Math.floor(y / CHUNK), Math.floor(z / CHUNK)];
            const key = this.chunkKey(cx, cy, cz);
            let chunk = this.chunks.get(key);

            if(!chunk)
            {
                const [rx, rz] = [Math.floor(x / REGION), Math.floor(z / REGION)];

                chunk = { x: cx - rx * REGION / CHUNK, y: cy, z: cz - rz * REGION / CHUNK, uniform: null, cells: new Uint8Array(CHUNK * CHUNK * CHUNK) };
                this.chunks.set(key, chunk);
                this.regions.get(this.regionOfColumn(x, z)).keys.push(key);
            }

            if(chunk.cells === null)
            {
                chunk.cells = new Uint8Array(CHUNK * CHUNK * CHUNK).fill(chunk.uniform);
                chunk.uniform = null;
            }

            chunk.cells[((y % CHUNK) * CHUNK + (z % CHUNK)) * CHUNK + (x % CHUNK)] = block;
            set.push([x, y, z]);
        }

        for(const column of new Set(set.map(([x, , z]) => z * this.columns + x)))
        {
            const [x, z] = [column % this.columns, Math.floor(column / this.columns)];
            let surface = this.height;

            while(surface > 0 && !this.isSolid(x, surface - 1, z)) { surface--; }

            this.surfaces[column] = surface;
        }

        for(const [x, y, z] of set)
        {
            const [cx, cy, cz] = [x, y, z].map((value) => Math.floor(value / CHUNK));

            for(const [dx, dy, dz] of AROUND) { this.coarse.delete(this.chunkKey(cx + dx, cy + dy, cz + dz)); }
        }

        if(set.length > 0) { this.emitRegion("cells", null, set); }

        return set;
    }

    /* COARSE CELLS ***********************************************************/

    // A chunk's cells in cubes of COARSE cells a side, for the glow of light:
    // `open` holds 1 for each coarse cell with fewer than half its cells
    // opaque, and `lights` [x, y, z, strength, colour] for each coarse cell a
    // light of the chunk glows from: the coarse cell's place in the zone, the
    // light's level as a share of 15, and its colour as 0xrrggbb. Null for a
    // chunk outside the zone or in a region not loaded.
    coarseOf(cx, cy, cz)
    {
        const entry = this.coarseEntry(cx, cy, cz);

        if(entry && !entry.lights) { entry.lights = this.coarseLights(entry.sources); }

        return entry;
    }

    coarseEntry(cx, cy, cz)
    {
        if(cx < 0 || cz < 0 || cy < 0 || cx >= this.chunksWide || cz >= this.chunksWide || cy >= this.chunksHigh) { return null; }
        if(!this.isColumnLoaded(cx * CHUNK, cz * CHUNK)) { return null; }

        const key = this.chunkKey(cx, cy, cz);

        if(!this.coarse.has(key)) { this.coarse.set(key, this.buildCoarse(this.chunks.get(key) ?? null, [cx, cy, cz])); }

        return this.coarse.get(key);
    }

    isCoarseOpen(x, y, z)
    {
        const entry = this.coarseEntry(Math.floor(x / COARSE_CHUNK), Math.floor(y / COARSE_CHUNK), Math.floor(z / COARSE_CHUNK));
        const local = (value) => ((value % COARSE_CHUNK) + COARSE_CHUNK) % COARSE_CHUNK;

        return entry !== null && entry.open[(local(y) * COARSE_CHUNK + local(z)) * COARSE_CHUNK + local(x)] === 1;
    }

    // `sources` lists the chunk's light cells as [x, y, z, block] in the zone.
    buildCoarse(chunk, [cx, cy, cz])
    {
        const open = new Uint8Array(COARSE_CHUNK * COARSE_CHUNK * COARSE_CHUNK).fill(1);
        const sources = [];
        const blocks = this.blocks;

        if(!chunk) { return { open, sources, lights: null }; }

        if(chunk.cells === null)
        {
            if(blocks.isOpaque(chunk.uniform)) { open.fill(0); }

            return { open, sources, lights: null };
        }

        const opaque = new Uint8Array(open.length);

        for(let y = 0; y < CHUNK; y++)
        {
            for(let z = 0; z < CHUNK; z++)
            {
                for(let x = 0; x < CHUNK; x++)
                {
                    const block = chunk.cells[(y * CHUNK + z) * CHUNK + x];
                    const coarse = (Math.floor(y / COARSE) * COARSE_CHUNK + Math.floor(z / COARSE)) * COARSE_CHUNK + Math.floor(x / COARSE);

                    if(blocks.isOpaque(block)) { opaque[coarse]++; }
                    if(blocks.light(block) > 0) { sources.push([cx * CHUNK + x, cy * CHUNK + y, cz * CHUNK + z, block]); }
                }
            }
        }

        for(let i = 0; i < open.length; i++) { open[i] = opaque[i] * 2 < COARSE ** 3 ? 1 : 0; }

        return { open, sources, lights: null };
    }

    coarseLights(sources)
    {
        const lights = [];

        for(const [x, y, z, block] of sources)
        {
            for(const [coarse, keep] of this.glowExits(x, y, z)) { lights.push(...coarse, this.blocks.light(block) / 15 * keep, this.blocks.glowKey(block)); }
        }

        return lights;
    }

    // The open coarse cells a light's glow starts from, each with the share
    // of the glow that reaches it. A light in an open coarse cell glows from
    // that cell. A light whose coarse cell is closed, such as embers set in a
    // hearth or a lantern against a wall, glows from the open coarse cells
    // that open cells lead to within GLOW_EXIT_STEPS cells of it, so its glow
    // leaves on the sides it is open to and not through the wall.
    glowExits(x, y, z)
    {
        const coarseOf = (cell) => cell.map((value) => Math.floor(value / COARSE));
        const isOpaque = (cell) => this.blocks.isOpaque(this.blockAt(...cell));

        if(!isOpaque([x, y, z]) && this.isCoarseOpen(...coarseOf([x, y, z]))) { return [[coarseOf([x, y, z]), 1]]; }

        const exits = new Map();
        const seen = new Set([x + "," + y + "," + z]);
        let frontier = [[x, y, z]];

        for(let step = 1; step <= GLOW_EXIT_STEPS && frontier.length > 0; step++)
        {
            const next = [];

            for(const [fx, fy, fz] of frontier)
            {
                for(const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]])
                {
                    const cell = [fx + dx, fy + dy, fz + dz];
                    const key = cell.join(",");

                    if(seen.has(key) || !this.isCell(...cell) || isOpaque(cell)) { continue; }

                    seen.add(key);

                    const coarse = coarseOf(cell);

                    if(this.isCoarseOpen(...coarse)) { exits.set(coarse.join(","), [coarse, Math.max(exits.get(coarse.join(","))?.[1] ?? 0, GLOW_EXIT_KEEP ** step)]); }
                    else { next.push(cell); }
                }
            }

            frontier = next;
        }

        return [...exits.values()];
    }

    // A light near the region's edge glows from coarse cells of its
    // neighbours, so every chunk's lights are found again.
    forgetCoarse(name)
    {
        for(const [key, entry] of this.coarse)
        {
            const [x, z] = [key % this.chunksWide, Math.floor(key / this.chunksWide) % this.chunksWide];

            if(this.regionOfColumn(x * CHUNK, z * CHUNK) === name) { this.coarse.delete(key); }
            else { entry.lights = null; }
        }
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

        if(this.moving.size > 0)
        {
            const moving = this.moving.get((y * this.columns + z) * this.columns + x);

            if(moving !== undefined) { return moving; }
        }

        const chunk = this.chunkAt(Math.floor(x / CHUNK), Math.floor(y / CHUNK), Math.floor(z / CHUNK));

        if(!chunk) { return BlockSet.AIR; }
        if(chunk.cells === null) { return chunk.uniform; }

        return chunk.cells[((y % CHUNK) * CHUNK + (z % CHUNK)) * CHUNK + (x % CHUNK)];
    }

    // Movers claim cells over the baked ones; `block` 0 frees them.
    setMoving(cells, block)
    {
        for(const [x, y, z] of cells)
        {
            const key = (y * this.columns + z) * this.columns + x;
            const column = z * this.columns + x;
            const count = this.movingColumns.get(column) ?? 0;

            if(block === 0 && this.moving.delete(key))
            {
                if(count > 1) { this.movingColumns.set(column, count - 1); }
                else { this.movingColumns.delete(column); }
            }

            if(block !== 0 && !this.moving.has(key)) { this.movingColumns.set(column, count + 1); }
            if(block !== 0) { this.moving.set(key, block); }
        }
    }

    // The smallest placed object whose box holds the cell, or null.
    objectAt(x, y, z)
    {
        const volume = ([x0, y0, z0, x1, y1, z1]) => (x1 - x0 + 1) * (y1 - y0 + 1) * (z1 - z0 + 1);
        const holding = this.objects.filter(({ box }) => box && x >= box[0] && y >= box[1] && z >= box[2] && x <= box[3] && y <= box[4] && z <= box[5]);

        return holding.sort((a, b) => volume(a.box) - volume(b.box))[0] ?? null;
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

    // The weathering age of a column, from 0 (new) to 100.
    age(column, row)
    {
        const x = Math.max(0, Math.min(this.columns - 1, column));
        const z = Math.max(0, Math.min(this.columns - 1, row));

        return this.ages[z * this.columns + x];
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
    // travels before it enters a cell that stops it, a solid one unless
    // `isStop(x, y, z)` says otherwise, up to `distance`.
    // Amanatides and Woo, "A Fast Voxel Traversal Algorithm for Ray Tracing".
    raycast(origin, direction, distance, isStop = (x, y, z) => this.isSolid(x, y, z))
    {
        const start = [(origin.x + this.half) * CUBES_PER_METRE, this.cellY(origin.y), (origin.z + this.half) * CUBES_PER_METRE];
        const along = [direction.x, direction.y, direction.z].map((value) => value * CUBES_PER_METRE);
        const cell = start.map(Math.floor);
        const step = along.map(Math.sign);
        const across = along.map((value) => (value === 0 ? Infinity : 1 / Math.abs(value)));
        const next = [0, 1, 2].map((axis) => (along[axis] === 0 ? Infinity : (step[axis] > 0 ? cell[axis] + 1 - start[axis] : start[axis] - cell[axis]) * across[axis]));

        if(isStop(...cell)) { return 0; }

        for(;;)
        {
            const axis = next[0] < next[1] ? (next[0] < next[2] ? 0 : 2) : (next[1] < next[2] ? 1 : 2);
            const travelled = next[axis];

            if(travelled > distance) { return distance; }

            cell[axis] += step[axis];
            next[axis] += across[axis];

            if(isStop(...cell)) { return travelled; }
        }
    }

    // The first cell that is not air a ray from `origin` along the unit
    // `direction` enters within `distance` metres, with the normal of the face
    // it enters through, or null. A ray that starts inside a cell gives that
    // cell, with no normal.
    pick(origin, direction, distance)
    {
        const start = [(origin.x + this.half) * CUBES_PER_METRE, this.cellY(origin.y), (origin.z + this.half) * CUBES_PER_METRE];
        const along = [direction.x, direction.y, direction.z].map((value) => value * CUBES_PER_METRE);
        const cell = start.map(Math.floor);
        const step = along.map(Math.sign);
        const across = along.map((value) => (value === 0 ? Infinity : 1 / Math.abs(value)));
        const next = [0, 1, 2].map((axis) => (along[axis] === 0 ? Infinity : (step[axis] > 0 ? cell[axis] + 1 - start[axis] : start[axis] - cell[axis]) * across[axis]));

        if(this.blockAt(...cell) !== BlockSet.AIR) { return { cell, normal: null, distance: 0 }; }

        for(;;)
        {
            const axis = next[0] < next[1] ? (next[0] < next[2] ? 0 : 2) : (next[1] < next[2] ? 1 : 2);
            const travelled = next[axis];

            if(travelled > distance) { return null; }

            cell[axis] += step[axis];
            next[axis] += across[axis];

            if(this.blockAt(...cell) !== BlockSet.AIR)
            {
                const normal = [0, 0, 0];

                normal[axis] = -step[axis];

                return { cell: [...cell], normal, distance: travelled };
            }
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
    // `limit`, or 0. A column a mover claims is searched, as its surface leaves
    // the mover out.
    topBelow(column, row, limit)
    {
        const surface = this.surface(column, row);
        const isMoving = this.movingColumns.has(row * this.columns + column);

        if(surface <= limit && !isMoving) { return surface; }

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
