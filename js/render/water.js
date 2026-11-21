import * as THREE from "three";

export class Water
{
    constructor(size, cells, level, material)
    {
        this.level = level;
        this.time = 0;

        const geometry = new THREE.PlaneGeometry(size, size, cells, cells).rotateX(-Math.PI / 2);

        geometry.translate(0, level, 0);

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.name = "water";
        this.mesh.receiveShadow = true;
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
