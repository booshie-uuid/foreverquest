const MAX_STEP_UP = 0.5;
const EDGE_MARGIN = 2;
const CELL = 4;


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
    static MAX_STEP_UP = MAX_STEP_UP;

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

    constructor(zone, prefabs)
    {
        this.id = zone.id;
        this.name = zone.name;
        this.welcome = zone.welcome ?? [];
        this.size = zone.size;
        this.half = zone.size / 2;
        this.step = zone.step;
        this.waterLevel = zone.waterLevel;
        this.lighting = zone.lighting;
        this.spawn = zone.spawn;
        this.people = zone.people;
        this.levels = Int16Array.from(zone.levels.flatMap((row) => row.split(",").map(Number)));
        this.types = zone.types.flatMap((row) => [...row].map((code) => zone.typeCodes[code]));
        this.runs = zone.runs;
        this.placements = [];
        this.colliders = [];
        this.lightSpots = [];

        this.place(zone.props, prefabs);
        this.grid = this.buildGrid();
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
            const placement = { prefab: prop.prefab, x: prop.x, y: this.heightAt(prop.x, prop.z), z: prop.z, angle: prop.angle ?? 0, scale: prop.scale ?? 1 };

            this.placements.push(placement);
            this.colliders.push(...prefab.colliders.map((collider) => placeCollider(collider, placement)));
            this.lightSpots.push(...prefab.lights.map((light) => ZoneData.toWorld(light, placement)));
        }
    }

    /* TILES ******************************************************************/

    tileOf(x, z)
    {
        return [Math.floor(x + this.half), Math.floor(z + this.half)];
    }

    isTile(column, row)
    {
        return column >= 0 && row >= 0 && column < this.size && row < this.size;
    }

    tileHeight(column, row)
    {
        const clampedColumn = Math.max(0, Math.min(this.size - 1, column));
        const clampedRow = Math.max(0, Math.min(this.size - 1, row));

        return this.levels[clampedRow * this.size + clampedColumn] * this.step;
    }

    tileType(column, row)
    {
        return this.isTile(column, row) ? this.types[row * this.size + column] : "edge";
    }

    heightAt(x, z)
    {
        return this.tileHeight(...this.tileOf(x, z));
    }

    typeAt(x, z)
    {
        return this.tileType(...this.tileOf(x, z));
    }

    isWater(x, z)
    {
        return this.heightAt(x, z) < this.waterLevel;
    }

    isInside(x, z, margin = 0)
    {
        return Math.abs(x) < this.half - margin && Math.abs(z) < this.half - margin;
    }

    /* MOVEMENT ***************************************************************/

    isWalkable(x, z)
    {
        return this.isInside(x, z, EDGE_MARGIN) && !this.isWater(x, z);
    }

    canStep(from, to)
    {
        return this.isWalkable(to.x, to.z) && this.heightAt(to.x, to.z) - this.heightAt(from.x, from.z) <= MAX_STEP_UP;
    }

    // Pushes the circle out of each nearby collider in turn, twice over, as
    // if it had tested every collider in the zone.
    resolveStep(from, to, radius)
    {
        const result = { x: to.x, z: to.z };
        const nearby = this.collidersNear(to.x, to.z, 2 * this.maxExtent + 2 * radius);

        for(let pass = 0; pass < 2; pass++)
        {
            for(const collider of nearby)
            {
                if(collider.radius !== undefined) { ZoneData.pushOutOfCircle(result, collider, radius); }
                else { ZoneData.pushOutOfBox(result, collider, radius); }
            }
        }

        if(!this.canStep(from, result)) { return { x: from.x, z: from.z }; }

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
