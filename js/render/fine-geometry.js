import * as FineMesher from "./fine-mesher.js";
import * as THREE from "three";


/******************************************************************************/
/* FINE GEOMETRY                                                              */
/******************************************************************************/

// The mesh of a grid of fine cubes, as FineMesher.decode gives it, in metres
// from its lower corner, with each face's layer in the world atlas.
export function build(grid, atlas, blocks)
{
    const geometry = new THREE.BufferGeometry();
    const mesh = FineMesher.mesh(grid, (block) => blocks.block(blocks.number(block)).faces, atlas.uvPerMetre);

    geometry.setAttribute("position", new THREE.Float32BufferAttribute(mesh.positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(mesh.normals, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(mesh.uvs, 2));
    geometry.setAttribute("layer", new THREE.Float32BufferAttribute(mesh.layers.map((texture) => atlas.layer(mesh.textures[texture])), 1));
    geometry.setIndex(mesh.indices);
    geometry.computeBoundingSphere();

    return geometry;
}
