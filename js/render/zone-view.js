import * as CubeMesher from "./cube-mesher.js";
import * as PropMesher from "./prop-mesher.js";
import * as RegionCodec from "../sim/region-codec.js";
import * as THREE from "three";
import { BlockBuilder } from "../geometry/block-builder.js";
import { Water } from "./water.js";
import { ZoneData } from "../sim/zone-data.js";

const PROP_CHUNK = 16;
const { CHUNK, REGION } = RegionCodec;
const CHUNK_METRES = CHUNK / ZoneData.CUBES_PER_METRE;
const TILE = 2;
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

    // Without workers, the view meshes every waiting chunk at once.
    constructor(zone, prefabs, materials, workers = null)
    {
        const lighting = zone.lighting;

        this.zone = zone;
        this.materials = materials;
        this.workers = workers;
        this.table = CubeMesher.faceTable(zone.blocks, materials.atlas);
        this.frame = { half: zone.half, base: zone.base, perCell: materials.atlas.uvPerMetre / ZoneData.CUBES_PER_METRE };
        this.scene = new THREE.Scene();
        this.chunkArrays = new Map();
        this.tileMeshes = new Map();
        this.dirtyTiles = new Set();
        this.focus = { x: zone.spawn.x, z: zone.spawn.z };
        this.waiting = new Set();
        this.versions = new Map();
        this.inFlight = 0;
        this.propMeshes = [];
        this.lamps = [];
        this.isDisposed = false;

        this.scene.fog = new THREE.Fog(lighting.sky.horizon, lighting.fog.near, lighting.fog.far);
        this.scene.background = new THREE.Color(lighting.sky.horizon);
        this.water = new Water(zone.size, WATER_CELLS, zone.waterLevel - 0.05, materials.water);
        this.scene.add(this.water.mesh);

        this.unsubscribe = zone.onRegion((event) => this.onRegion(event));

        for(const name of zone.regions.keys()) { this.queueRegion(name); }

        this.meshWaiting();
        this.buildTiles();
        this.addProps(prefabs);
        this.addSky(lighting.sky);
        this.addLights(lighting);
    }

    heightAt(x, z)
    {
        return this.zone.heightAt(x, z);
    }

    get terrainMeshes()
    {
        return [...this.tileMeshes.values()];
    }

    get isSettled()
    {
        return this.waiting.size === 0 && this.inFlight === 0 && this.dirtyTiles.size === 0;
    }

    /* TERRAIN ****************************************************************/

    onRegion({ type, name })
    {
        if(type === "added") { this.queueRegion(name); }
        if(type === "removed") { this.dropRegion(name); }
    }

    // The loaded chunks on the region's border join it, because their faces
    // toward it change.
    queueRegion(name)
    {
        for(const key of this.chunkKeys(name, 1)) { if(this.zone.chunks.has(key) && !this.isBuried(key)) { this.waiting.add(key); } }
    }

    isBuried(key)
    {
        const zone = this.zone;
        const wide = zone.chunksWide;
        const [x, y, z] = this.chunkPosition(key);
        const isSolidChunk = (cx, cy, cz) =>
        {
            if(cy < 0) { return true; }

            const chunk = zone.chunkAt(cx, cy, cz);

            return chunk !== null && chunk.cells === null && zone.blocks.isOpaque(chunk.uniform) && cx >= 0 && cz >= 0 && cx < wide && cz < wide;
        };

        return isSolidChunk(x, y, z) && [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].every(([dx, dy, dz]) => isSolidChunk(x + dx, y + dy, z + dz));
    }

    dropRegion(name)
    {
        for(const key of this.chunkKeys(name, 0))
        {
            this.waiting.delete(key);
            this.versions.delete(key);

            if(this.chunkArrays.delete(key)) { this.dirtyTiles.add(this.tileOf(key)); }
        }
    }

    chunkKeys(name, border)
    {
        const [left, top] = ZoneData.regionCorner(name).map((cells) => cells / CHUNK);
        const span = REGION / CHUNK;
        const wide = this.zone.chunksWide;
        const keys = [];

        for(let cy = 0; cy < this.zone.chunksHigh; cy++)
        {
            for(let cz = Math.max(0, top - border); cz < Math.min(wide, top + span + border); cz++)
            {
                for(let cx = Math.max(0, left - border); cx < Math.min(wide, left + span + border); cx++) { keys.push(this.zone.chunkKey(cx, cy, cz)); }
            }
        }

        return keys;
    }

    chunkPosition(key)
    {
        const wide = this.zone.chunksWide;

        return [key % wide, Math.floor(key / (wide * wide)), Math.floor(key / wide) % wide];
    }

    tileOf(key)
    {
        const [x, , z] = this.chunkPosition(key);

        return Math.floor(x / TILE) + "," + Math.floor(z / TILE);
    }

    meshWaiting()
    {
        if(this.waiting.size === 0) { return; }

        const capacity = this.workers ? this.workers.capacity : this.waiting.size;
        const distance = (key) =>
        {
            const [x, , z] = this.chunkPosition(key);

            return Math.hypot((x + 0.5) * CHUNK_METRES - this.zone.half - this.focus.x, (z + 0.5) * CHUNK_METRES - this.zone.half - this.focus.z);
        };
        const nearest = capacity >= this.waiting.size ? [...this.waiting] : [...this.waiting].sort((a, b) => distance(a) - distance(b)).slice(0, capacity);

        for(const key of nearest)
        {
            this.waiting.delete(key);
            this.meshChunk(key);
        }
    }

    meshChunk(key)
    {
        const position = this.chunkPosition(key);
        const cells = CubeMesher.paddedCells(this.zone, ...position);
        const origin = position.map((value) => value * CHUNK);
        const version = (this.versions.get(key) ?? 0) + 1;

        this.versions.set(key, version);

        if(!this.workers)
        {
            this.placeChunk(key, CubeMesher.meshCells(cells, this.table, origin, this.frame));
            return;
        }

        this.inFlight++;
        this.workers.mesh(cells, origin, this.frame).then((arrays) =>
        {
            this.inFlight--;

            if(!this.isDisposed && this.versions.get(key) === version) { this.placeChunk(key, arrays); }
        }, () => { this.inFlight--; });
    }

    placeChunk(key, arrays)
    {
        if(arrays) { this.chunkArrays.set(key, arrays); }
        else { this.chunkArrays.delete(key); }

        this.dirtyTiles.add(this.tileOf(key));
    }

    buildTiles()
    {
        for(const tile of this.dirtyTiles)
        {
            const [tx, tz] = tile.split(",").map(Number);
            const wide = this.zone.chunksWide;
            const parts = [];

            for(let cy = 0; cy < this.zone.chunksHigh; cy++)
            {
                for(let cz = tz * TILE; cz < Math.min(wide, (tz + 1) * TILE); cz++)
                {
                    for(let cx = tx * TILE; cx < Math.min(wide, (tx + 1) * TILE); cx++)
                    {
                        const arrays = this.chunkArrays.get(this.zone.chunkKey(cx, cy, cz));

                        if(arrays) { parts.push(arrays); }
                    }
                }
            }

            this.removeTile(tile);

            if(parts.length > 0) { this.addTile(tile, ZoneView.geometryOf(ZoneView.joined(parts))); }
        }

        this.dirtyTiles.clear();
    }

    addTile(tile, geometry)
    {
        const mesh = new THREE.Mesh(geometry, this.materials.terrain);

        mesh.name = "terrain";
        mesh.receiveShadow = true;
        this.tileMeshes.set(tile, mesh);
        this.scene.add(mesh);
    }

    removeTile(tile)
    {
        const mesh = this.tileMeshes.get(tile);

        if(!mesh) { return; }

        mesh.geometry.dispose();
        this.scene.remove(mesh);
        this.tileMeshes.delete(tile);
    }

    static joined(parts)
    {
        if(parts.length === 1) { return parts[0]; }

        const joined = {};
        let vertices = 0;

        for(const name of ["positions", "normals", "uvs", "layers", "colours"])
        {
            joined[name] = new Float32Array(parts.reduce((total, part) => total + part[name].length, 0));

            let at = 0;

            for(const part of parts)
            {
                joined[name].set(part[name], at);
                at += part[name].length;
            }
        }

        joined.indices = new Uint32Array(parts.reduce((total, part) => total + part.indices.length, 0));

        let at = 0;

        for(const part of parts)
        {
            for(let i = 0; i < part.indices.length; i++) { joined.indices[at + i] = part.indices[i] + vertices; }

            at += part.indices.length;
            vertices += part.positions.length / 3;
        }

        return joined;
    }

    /* PROPS ******************************************************************/

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
        this.focus = focus;
        this.meshWaiting();
        this.buildTiles();
        this.water.update(delta);
        this.sky.position.copy(camera.position);
        this.moon.position.set(focus.x - 20, focus.y + 40, focus.z + 14);
        this.moon.target.position.copy(focus);
        this.placeLamps(focus);
    }

    dispose()
    {
        this.unsubscribe();
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
