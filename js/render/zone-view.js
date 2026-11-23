import * as CubeMesher from "./cube-mesher.js";
import * as PropMesher from "./prop-mesher.js";
import * as THREE from "three";
import { BlockBuilder } from "../geometry/block-builder.js";
import { Water } from "./water.js";

const PROP_CHUNK = 16;
const LIGHT_BUDGET = 6;
const SHADOW_RANGE = 26;
const WATER_CELLS = 48;
const SKY_RADIUS = 300;


/******************************************************************************/
/* ZONE VIEW                                                                  */
/******************************************************************************/

export class ZoneView
{
    static LIGHT_BUDGET = LIGHT_BUDGET;

    constructor(zone, prefabs, materials)
    {
        const lighting = zone.lighting;

        this.zone = zone;
        this.materials = materials;
        this.scene = new THREE.Scene();
        this.terrainMeshes = [];
        this.propMeshes = [];
        this.lamps = [];
        this.isDisposed = false;

        this.scene.fog = new THREE.Fog(lighting.sky.horizon, lighting.fog.near, lighting.fog.far);
        this.scene.background = new THREE.Color(lighting.sky.horizon);
        this.water = new Water(zone.size, WATER_CELLS, zone.waterLevel - 0.05, materials.water);
        this.scene.add(this.water.mesh);

        this.addTerrain();
        this.addProps(prefabs);
        this.addSky(lighting.sky);
        this.addLights(lighting);
    }

    heightAt(x, z)
    {
        return this.zone.heightAt(x, z);
    }

    /* MESHES *****************************************************************/

    addTerrain()
    {
        const atlas = this.materials.atlas;
        const table = CubeMesher.faceTable(this.zone.blocks, atlas);
        const wide = this.zone.chunksWide;

        for(const key of this.zone.chunks.keys())
        {
            const arrays = CubeMesher.buildChunk(this.zone, table, atlas, key % wide, Math.floor(key / (wide * wide)), Math.floor(key / wide) % wide);

            if(!arrays) { continue; }

            const mesh = new THREE.Mesh(ZoneView.geometryOf(arrays), this.materials.terrain);

            mesh.name = "terrain";
            mesh.receiveShadow = true;
            this.terrainMeshes.push(mesh);
            this.scene.add(mesh);
        }
    }

    static geometryOf(arrays)
    {
        const geometry = new THREE.BufferGeometry();

        geometry.setAttribute("position", new THREE.BufferAttribute(arrays.positions, 3));
        geometry.setAttribute("normal", new THREE.BufferAttribute(arrays.normals, 3));
        geometry.setAttribute("uv", new THREE.BufferAttribute(arrays.uvs, 2));
        geometry.setAttribute("layer", new THREE.BufferAttribute(arrays.layers, 1));
        geometry.setAttribute("color", new THREE.BufferAttribute(arrays.colours, 3));
        geometry.setIndex(new THREE.BufferAttribute(arrays.indices, 1));
        geometry.computeBoundingSphere();

        return geometry;
    }

    // Each placement joins the chunk under its origin, and each block of a
    // run joins the chunk under the block.
    addProps(prefabs)
    {
        const atlas = this.materials.atlas;
        const chunks = new Map();
        const chunkAt = (x, z) =>
        {
            const key = Math.floor((x + this.zone.half) / PROP_CHUNK) + "," + Math.floor((z + this.zone.half) / PROP_CHUNK);

            if(!chunks.has(key)) { chunks.set(key, new BlockBuilder()); }

            return chunks.get(key);
        };

        for(const placement of this.zone.placements)
        {
            if(placement.run === undefined)
            {
                PropMesher.addPrefab(chunkAt(placement.x, placement.z), atlas, prefabs[placement.prefab], placement);
                continue;
            }

            for(const block of this.zone.runs[placement.run].blocks) { PropMesher.addBlocks(chunkAt(block.at[0], block.at[2]), atlas, [block]); }
        }

        for(const builder of chunks.values())
        {
            const mesh = new THREE.Mesh(builder.build(), this.materials.world);

            mesh.name = "props";
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.propMeshes.push(mesh);
            this.scene.add(mesh);
        }
    }

    addSky(sky)
    {
        const geometry = new THREE.SphereGeometry(SKY_RADIUS, 16, 12);
        const position = geometry.getAttribute("position");
        const top = new THREE.Color(sky.top);
        const horizon = new THREE.Color(sky.horizon);
        const colours = [];

        for(let i = 0; i < position.count; i++)
        {
            const colour = horizon.clone().lerp(top, Math.pow(Math.max(0, position.getY(i) / SKY_RADIUS), 0.5));

            colours.push(colour.r, colour.g, colour.b);
        }

        geometry.setAttribute("color", new THREE.Float32BufferAttribute(colours, 3));

        this.sky = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
        this.sky.renderOrder = -2;

        const moon = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshBasicMaterial({ color: "#c8cdd6", fog: false, depthWrite: false }));

        moon.position.set(-120, 150, -180);
        moon.lookAt(0, 0, 0);
        moon.renderOrder = -1;
        this.sky.add(moon);
        this.scene.add(this.sky);
    }

    /* LIGHTS *****************************************************************/

    // A fixed number of point lights follows the nearest lamps, because
    // changing the number of lights recompiles every lit shader.
    addLights(lighting)
    {
        const { hemisphere, moon, lamp } = lighting;

        this.scene.add(new THREE.HemisphereLight(hemisphere.sky, hemisphere.ground, hemisphere.intensity));

        this.moon = new THREE.DirectionalLight(moon.colour, moon.intensity);
        this.moon.castShadow = true;
        this.moon.shadow.mapSize.set(2048, 2048);
        this.moon.shadow.camera.left = -SHADOW_RANGE;
        this.moon.shadow.camera.right = SHADOW_RANGE;
        this.moon.shadow.camera.top = SHADOW_RANGE;
        this.moon.shadow.camera.bottom = -SHADOW_RANGE;
        this.moon.shadow.camera.near = 1;
        this.moon.shadow.camera.far = 120;
        this.moon.shadow.bias = -0.0006;
        this.moon.shadow.normalBias = 0.02;
        this.scene.add(this.moon, this.moon.target);

        for(let i = 0; i < LIGHT_BUDGET; i++)
        {
            const light = new THREE.PointLight(lamp.colour, 0, lamp.distance, lamp.decay);

            this.lamps.push(light);
            this.scene.add(light);
        }

        this.lampIntensity = lamp.intensity;
    }

    placeLamps(focus)
    {
        const nearest = [...this.zone.lightSpots]
            .sort((a, b) => Math.hypot(a[0] - focus.x, a[2] - focus.z) - Math.hypot(b[0] - focus.x, b[2] - focus.z))
            .slice(0, LIGHT_BUDGET);

        this.lamps.forEach((light, i) =>
        {
            light.intensity = nearest[i] ? this.lampIntensity : 0;

            if(nearest[i]) { light.position.set(...nearest[i]); }
        });
    }

    /* FRAME ******************************************************************/

    update(delta, camera, focus)
    {
        this.water.update(delta);
        this.sky.position.copy(camera.position);
        this.moon.position.set(focus.x - 20, focus.y + 40, focus.z + 14);
        this.moon.target.position.copy(focus);
        this.placeLamps(focus);
    }

    dispose()
    {
        this.scene.traverse((node) =>
        {
            node.geometry?.dispose();

            if(node.material && node.material !== this.materials.world && node.material !== this.materials.terrain && node.material !== this.materials.water) { node.material.dispose(); }
        });

        this.moon.shadow.map?.dispose();
        this.scene.clear();
        this.isDisposed = true;
    }
}
