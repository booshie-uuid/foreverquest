import * as Noise from "../util/noise.js";
import * as THREE from "three";

const STEP = 0.25;
const WATER_LEVEL = -0.1;
const SQUARE_RADIUS = 7;
const VILLAGE_RADIUS = 18;
const LAKE = { x: 22, z: 16, radius: 9, depth: 2.5 };

const PATHS =
[
    [[0, 0], [9, 5], [16, 10]],
    [[0, 0], [-2, -12], [-3, -26]],
    [[0, 0], [-14, 2], [-26, 5], [-42, 4]],
    [[0, 0], [3, 14], [2, 30], [-4, 44]],
];

const NEIGHBOURS = [[1, 0], [-1, 0], [0, 1], [0, -1]];


/******************************************************************************/
/* TERRAIN                                                                    */
/******************************************************************************/

export class Terrain
{
    static WATER_LEVEL = WATER_LEVEL;
    static STEP = STEP;

    constructor(seed, size = 96)
    {
        this.seed = seed;
        this.size = size;
        this.half = size / 2;
        this.levels = new Int16Array(size * size);
        this.types = [];

        for(let row = 0; row < size; row++)
        {
            for(let column = 0; column < size; column++)
            {
                const [x, z] = this.centre(column, row);

                this.levels[row * size + column] = Math.round(Terrain.shape(x, z, seed) / STEP);
            }
        }

        for(let row = 0; row < size; row++)
        {
            for(let column = 0; column < size; column++) { this.types.push(this.classify(column, row)); }
        }
    }

    static shape(x, z, seed)
    {
        const radius = Math.hypot(x, z);
        const edge = Math.max(Math.abs(x), Math.abs(z));
        const rolling = (Noise.fractal(x * 0.05 + 30, z * 0.05 + 30, seed, 3) - 0.45) * 5;
        const walls = Noise.smoothstep(34, 46, edge) * (4 + Noise.fractal(x * 0.1, z * 0.1, seed + 3, 2) * 5);
        const lake = Noise.smoothstep(LAKE.radius, 2, Math.hypot(x - LAKE.x, z - LAKE.z)) * LAKE.depth;
        const village = Noise.smoothstep(VILLAGE_RADIUS + 6, VILLAGE_RADIUS - 4, radius);
        const wild = Math.max(rolling, 0) + walls - lake;

        return wild + (0.5 - wild) * village;
    }

    static pathDistance(x, z)
    {
        let best = Infinity;

        for(const path of PATHS)
        {
            for(let i = 0; i < path.length - 1; i++)
            {
                best = Math.min(best, Terrain.segmentDistance(x, z, path[i], path[i + 1]));
            }
        }

        return best;
    }

    static segmentDistance(x, z, a, b)
    {
        const dx = b[0] - a[0];
        const dz = b[1] - a[1];
        const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));

        return Math.hypot(x - (a[0] + dx * t), z - (a[1] + dz * t));
    }

    /* TILES ******************************************************************/

    centre(column, row)
    {
        return [column - this.half + 0.5, row - this.half + 0.5];
    }

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

        return this.levels[clampedRow * this.size + clampedColumn] * STEP;
    }

    typeAt(x, z)
    {
        const [column, row] = this.tileOf(x, z);

        return this.isTile(column, row) ? this.types[row * this.size + column] : "edge";
    }

    heightAt(x, z)
    {
        const [column, row] = this.tileOf(x, z);

        return this.tileHeight(column, row);
    }

    isWater(x, z)
    {
        return this.heightAt(x, z) < WATER_LEVEL;
    }

    isInside(x, z, margin = 0)
    {
        return Math.abs(x) < this.half - margin && Math.abs(z) < this.half - margin;
    }

    classify(column, row)
    {
        const [x, z] = this.centre(column, row);
        const height = this.tileHeight(column, row);
        const path = Terrain.pathDistance(x, z);
        const wobble = Noise.value(x * 0.7, z * 0.7, this.seed + 9);

        if(height < WATER_LEVEL) { return "mud"; }
        if(Math.hypot(x, z) < SQUARE_RADIUS + wobble) { return "cobble"; }
        if(path < 1.1 + wobble * 0.5) { return path < 0.6 && Math.hypot(x, z) < VILLAGE_RADIUS ? "cobble" : "mud"; }
        if(height <= 0 && this.nearWater(column, row)) { return "sand"; }
        if(height >= 4) { return wobble > 0.5 ? "stone" : "darkStone"; }

        return Noise.fractal(x * 0.12, z * 0.12, this.seed + 5, 2) > 0.52 ? "moss" : "grass";
    }

    nearWater(column, row)
    {
        for(let dz = -2; dz <= 2; dz++)
        {
            for(let dx = -2; dx <= 2; dx++)
            {
                if(this.tileHeight(column + dx, row + dz) < WATER_LEVEL) { return true; }
            }
        }

        return false;
    }

    /* MESH *******************************************************************/

    buildMesh(material, atlas)
    {
        const out = { positions: [], normals: [], uvs: [], layers: [] };

        for(let row = 0; row < this.size; row++)
        {
            for(let column = 0; column < this.size; column++) { this.addTile(out, atlas, column, row); }
        }

        const geometry = new THREE.BufferGeometry();

        geometry.setAttribute("position", new THREE.Float32BufferAttribute(out.positions, 3));
        geometry.setAttribute("normal", new THREE.Float32BufferAttribute(out.normals, 3));
        geometry.setAttribute("uv", new THREE.Float32BufferAttribute(out.uvs, 2));
        geometry.setAttribute("layer", new THREE.Float32BufferAttribute(out.layers, 1));
        geometry.computeBoundingSphere();

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.name = "terrain";
        this.mesh.receiveShadow = true;

        return this.mesh;
    }

    addTile(out, atlas, column, row)
    {
        const x0 = column - this.half;
        const z0 = row - this.half;
        const height = this.tileHeight(column, row);
        const top = atlas.layer(this.types[row * this.size + column]);
        const perMetre = atlas.uvPerMetre;

        Terrain.quad(out,
            [[x0, height, z0 + 1], [x0 + 1, height, z0 + 1], [x0 + 1, height, z0], [x0, height, z0]],
            [0, 1, 0],
            [x0 * perMetre, -(z0 + 1) * perMetre, (x0 + 1) * perMetre, -z0 * perMetre],
            top);

        for(const [dx, dz] of NEIGHBOURS)
        {
            const below = this.isTile(column + dx, row + dz) ? this.tileHeight(column + dx, row + dz) : height - 2;

            if(below >= height) { continue; }

            const side = height - below > 1.5 || height >= 4 ? "darkStone" : "earth";

            this.addSide(out, x0, z0, dx, dz, below, height, atlas.layer(side), perMetre);
        }
    }

    addSide(out, x0, z0, dx, dz, low, high, layer, perMetre)
    {
        const corners =
        {
            "1,0": [[x0 + 1, z0 + 1], [x0 + 1, z0]],
            "-1,0": [[x0, z0], [x0, z0 + 1]],
            "0,1": [[x0, z0 + 1], [x0 + 1, z0 + 1]],
            "0,-1": [[x0 + 1, z0], [x0, z0]],
        }[dx + "," + dz];
        const [[ax, az], [bx, bz]] = corners;
        const along = dx === 0 ? ax : az;
        const sign = dx === 0 ? Math.sign(bx - ax) : Math.sign(bz - az);

        Terrain.quad(out,
            [[ax, low, az], [bx, low, bz], [bx, high, bz], [ax, high, az]],
            [dx, 0, dz],
            [along * sign * perMetre, low * perMetre, (along + sign) * sign * perMetre, high * perMetre],
            layer);
    }

    static quad(out, corners, normal, uv, layer)
    {
        const [u0, v0, u1, v1] = uv;
        const cornerUvs = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];

        for(const index of [0, 1, 2, 0, 2, 3])
        {
            out.positions.push(...corners[index]);
            out.normals.push(...normal);
            out.uvs.push(...cornerUvs[index]);
            out.layers.push(layer);
        }
    }
}
