import * as THREE from "three";

// `reach` holds how far in metres the water runs past each side named, from
// north, east, south and west.
export class Water
{
    constructor(size, cells, level, material, reach = {})
    {
        this.level = level;
        this.time = 0;

        const { north = 0, east = 0, south = 0, west = 0 } = reach;
        const [width, depth] = [size + west + east, size + north + south];
        const geometry = new THREE.PlaneGeometry(width, depth, Math.ceil(cells * width / size), Math.ceil(cells * depth / size)).rotateX(-Math.PI / 2);

        geometry.translate((east - west) / 2, level, (south - north) / 2);

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.name = "water";
        this.mesh.receiveShadow = true;
    }

    dispose()
    {
        this.mesh.geometry.dispose();
    }

    update(delta)
    {
        const position = this.mesh.geometry.getAttribute("position");
        const time = this.time + delta;

        this.time = time;

        for(let i = 0; i < position.count; i++)
        {
            const x = position.getX(i);
            const z = position.getZ(i);
            const wave = Math.sin(x * 0.6 + time * 0.9) * 0.025 + Math.cos(z * 0.5 + time * 0.7) * 0.025;

            position.setY(i, this.level + wave);
        }

        position.needsUpdate = true;
        this.mesh.geometry.computeVertexNormals();
    }
}
