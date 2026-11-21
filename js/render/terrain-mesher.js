import * as THREE from "three";

const NEIGHBOURS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const TALL_DROP = 1.5;
const HIGH_GROUND = 4;

export function buildChunk(zone, atlas, column, row, count)
{
    const out = { positions: [], normals: [], uvs: [], layers: [] };

    for(let r = row; r < row + count; r++)
    {
        for(let c = column; c < column + count; c++) { addTile(out, zone, atlas, c, r); }
    }

    const geometry = new THREE.BufferGeometry();

    geometry.setAttribute("position", new THREE.Float32BufferAttribute(out.positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(out.normals, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(out.uvs, 2));
    geometry.setAttribute("layer", new THREE.Float32BufferAttribute(out.layers, 1));
    geometry.computeBoundingSphere();

    return geometry;
}

function addTile(out, zone, atlas, column, row)
{
    const x0 = column - zone.half;
    const z0 = row - zone.half;
    const height = zone.tileHeight(column, row);
    const perMetre = atlas.uvPerMetre;

    quad(out,
        [[x0, height, z0 + 1], [x0 + 1, height, z0 + 1], [x0 + 1, height, z0], [x0, height, z0]],
        [0, 1, 0],
        [x0 * perMetre, -(z0 + 1) * perMetre, (x0 + 1) * perMetre, -z0 * perMetre],
        atlas.layer(zone.tileType(column, row)));

    for(const [dx, dz] of NEIGHBOURS)
    {
        const below = zone.isTile(column + dx, row + dz) ? zone.tileHeight(column + dx, row + dz) : height - 2;

        if(below >= height) { continue; }

        const side = height - below > TALL_DROP || height >= HIGH_GROUND ? "darkStone" : "earth";

        addSide(out, x0, z0, dx, dz, below, height, atlas.layer(side), perMetre);
    }
}

function addSide(out, x0, z0, dx, dz, low, high, layer, perMetre)
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

    quad(out,
        [[ax, low, az], [bx, low, bz], [bx, high, bz], [ax, high, az]],
        [dx, 0, dz],
        [along * sign * perMetre, low * perMetre, (along + sign) * sign * perMetre, high * perMetre],
        layer);
}

function quad(out, corners, normal, uv, layer)
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
