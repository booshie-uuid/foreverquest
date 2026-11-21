import * as THREE from "three";

// Each face's u and v axes run left to right and bottom to top as seen from
// outside, so painted textures stand upright. The character's left is +x.
const FACES =
[
    { name: "front", normal: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], size: [0, 1] },
    { name: "back", normal: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0], size: [0, 1] },
    { name: "left", normal: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0], size: [2, 1] },
    { name: "right", normal: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], size: [2, 1] },
    { name: "top", normal: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1], size: [0, 2] },
    { name: "bottom", normal: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1], size: [0, 2] },
];

const DEPTH_AXIS = { front: 2, back: 2, left: 0, right: 0, top: 1, bottom: 1 };


/******************************************************************************/
/* BLOCK BUILDER                                                              */
/******************************************************************************/

export class BlockBuilder
{
    static FACES = FACES;

    constructor()
    {
        this.positions = [];
        this.normals = [];
        this.uvs = [];
        this.layers = [];
    }

    get isEmpty()
    {
        return this.positions.length === 0;
    }

    get triangleCount()
    {
        return this.positions.length / 9;
    }

    static faceSize(faceName, size)
    {
        const face = FACES.find((entry) => entry.name === faceName);

        return [size[face.size[0]], size[face.size[1]]];
    }

    // mapFace(faceName, width, height) returns { uv: [u0, v0, u1, v1], layer }
    // for a face to draw, or null to leave the face out.
    add(size, at, rotation, mapFace)
    {
        const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(rotation?.[0] ?? 0, rotation?.[1] ?? 0, rotation?.[2] ?? 0, "YXZ"));
        const centre = new THREE.Vector3(...at);

        for(const face of FACES)
        {
            const [width, height] = BlockBuilder.faceSize(face.name, size);
            const mapping = mapFace(face.name, width, height);

            if(!mapping) { continue; }

            const depth = size[DEPTH_AXIS[face.name]] / 2;
            const normal = new THREE.Vector3(...face.normal);
            const u = new THREE.Vector3(...face.u);
            const v = new THREE.Vector3(...face.v);
            const origin = normal.clone().multiplyScalar(depth).addScaledVector(u, -width / 2).addScaledVector(v, -height / 2);
            const corners =
            [
                origin.clone(),
                origin.clone().addScaledVector(u, width),
                origin.clone().addScaledVector(u, width).addScaledVector(v, height),
                origin.clone().addScaledVector(v, height),
            ].map((corner) => corner.applyQuaternion(quaternion).add(centre));

            const [u0, v0, u1, v1] = mapping.uv;
            const cornerUvs = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
            const turned = normal.applyQuaternion(quaternion);

            for(const index of [0, 1, 2, 0, 2, 3])
            {
                this.positions.push(corners[index].x, corners[index].y, corners[index].z);
                this.normals.push(turned.x, turned.y, turned.z);
                this.uvs.push(...cornerUvs[index]);
                this.layers.push(mapping.layer ?? 0);
            }
        }
    }

    build()
    {
        const geometry = new THREE.BufferGeometry();

        geometry.setAttribute("position", new THREE.Float32BufferAttribute(this.positions, 3));
        geometry.setAttribute("normal", new THREE.Float32BufferAttribute(this.normals, 3));
        geometry.setAttribute("uv", new THREE.Float32BufferAttribute(this.uvs, 2));
        geometry.setAttribute("layer", new THREE.Float32BufferAttribute(this.layers, 1));
        geometry.computeBoundingSphere();

        return geometry;
    }
}
