import * as CubeMesher from "./cube-mesher.js";
import * as FineMesher from "./fine-mesher.js";
import * as RegionCodec from "../sim/region-codec.js";
import * as THREE from "three";
import { Water } from "./water.js";
import { ZoneData } from "../sim/zone-data.js";

const { CHUNK, REGION } = RegionCodec;
const CHUNK_METRES = CHUNK / ZoneData.CUBES_PER_METRE;
const TILE = 2;
const SHADOW_RANGE = 26;
const WATER_CELLS = 48;
const SKY_RADIUS = 300;
const OBJECT_DROP = 8;
const MOON_AT = [-120, 150, -180];
const SUN_AT = [90, 220, -120];
const LIGHT_DISTANCE = 46;

// Daylight for every zone until a zone gives its own.
const DAY =
{
    sky: { top: "#5f86b8", horizon: "#b9c8d4" },
    hemisphere: { sky: "#c4d4e8", ground: "#5c4c34", intensity: 1.6 },
    sun: { colour: "#fff1d6", intensity: 2.8 },
    steps: { sky: { dark: "#3a3f48", bright: "#f2ead8", curve: 1.0 }, lamp: { dark: "#000000", bright: "#ffb466", curve: 1.0 } },
};


/******************************************************************************/
/* ZONE VIEW                                                                  */
/******************************************************************************/

export class ZoneView
{
    // Without workers, the view meshes every waiting chunk at once.
    // `objects` holds the baked fine-cube objects by id.
    constructor(zone, materials, workers = null, objects = {})
    {
        const lighting = zone.lighting;

        this.zone = zone;
        this.materials = materials;
        this.workers = workers;
        this.table = CubeMesher.faceTable(zone.blocks, materials.atlas);
        this.frame = { half: zone.half, base: zone.base, perCell: materials.atlas.uvPerMetre / ZoneData.CUBES_PER_METRE };
        this.scene = new THREE.Scene();
        this.objectMeshes = new Map();
        this.objectSlots = new Map();
        this.objectGeometries = new Map(Object.entries(objects).map(([id, object]) => [id, ZoneView.objectGeometry(object, materials.atlas, zone.blocks)]));
        this.chunkArrays = new Map();
        this.floors = new Map();
        this.tileMeshes = new Map();
        this.dirtyTiles = new Set();
        this.focus = { x: zone.spawn.x, z: zone.spawn.z };
        this.waiting = new Set();
        this.versions = new Map();
        this.inFlight = 0;
        this.isDay = false;
        this.isDisposed = false;

        this.scene.fog = new THREE.Fog(lighting.sky.horizon, lighting.fog.near, lighting.fog.far);
        this.scene.background = new THREE.Color(lighting.sky.horizon);
        this.water = new Water(zone.size, WATER_CELLS, zone.waterLevel - 0.05, materials.water);
        this.scene.add(this.water.mesh);

        this.unsubscribe = zone.onRegion((event) => this.onRegion(event));
        materials.setSteps(lighting.steps);
        materials.setAmbient(lighting.ambient);
        materials.setHeightFog(lighting.fog.height);

        for(const name of zone.regions.keys())
        {
            this.queueRegion(name);
            this.addObjects(name);
        }

        this.meshWaiting();
        this.buildTiles();
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

    onRegion({ type, name, cells })
    {
        if(type === "added")
        {
            this.queueRegion(name);
            this.addObjects(name);
        }

        if(type === "removed")
        {
            this.dropRegion(name);
            this.removeObjects(name);
        }

        if(type === "replaced") { this.queueRegion(name, true); }
        if(type === "cells") { this.queueCells(cells); }

        if(type === "objects")
        {
            for(const region of this.zone.regions.keys())
            {
                this.removeObjects(region);
                this.addObjects(region);
            }
        }
    }

    // A changed cell changes the light of every chunk within the mesher's
    // margin of it, and the sky light of every chunk below those.
    queueCells(cells)
    {
        const zone = this.zone;
        const columns = new Set();

        for(const [x, , z] of cells)
        {
            for(const dz of [-1, 0, 1])
            {
                for(const dx of [-1, 0, 1])
                {
                    const [cx, cz] = [Math.floor(x / CHUNK) + dx, Math.floor(z / CHUNK) + dz];

                    if(cx >= 0 && cz >= 0 && cx < zone.chunksWide && cz < zone.chunksWide) { columns.add(cz * zone.chunksWide + cx); }
                }
            }
        }

        for(const column of columns)
        {
            for(let cy = 0; cy < zone.chunksHigh; cy++)
            {
                const key = zone.chunkKey(column % zone.chunksWide, cy, Math.floor(column / zone.chunksWide));

                if(zone.chunks.has(key) || this.chunkArrays.has(key)) { this.waiting.add(key); }
            }
        }
    }

    // The loaded chunks on the region's border join it, because their faces
    // toward it change. A region baked again also meshes the chunks it lost,
    // which leaves them empty.
    queueRegion(name, isReplaced = false)
    {
        for(const key of this.chunkKeys(name, 1))
        {
            const isLost = isReplaced && this.chunkArrays.has(key);

            if(isLost || (this.zone.chunks.has(key) && !this.isBuried(key))) { this.waiting.add(key); }
        }
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
            this.floors.delete(key);

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
        const volume = CubeMesher.paddedCells(this.zone, ...position);
        const origin = position.map((value) => value * CHUNK);
        const version = (this.versions.get(key) ?? 0) + 1;

        this.versions.set(key, version);

        if(!this.workers)
        {
            this.placeChunk(key, CubeMesher.meshCells(volume, this.table, origin, this.frame));
            return;
        }

        this.inFlight++;
        this.workers.mesh(volume, origin, this.frame).then((arrays) =>
        {
            this.inFlight--;

            if(!this.isDisposed && this.versions.get(key) === version) { this.placeChunk(key, arrays); }
        }, () => { this.inFlight--; });
    }

    placeChunk(key, arrays)
    {
        this.floors.set(key, arrays.floors);

        if(arrays.indices) { this.chunkArrays.set(key, arrays); }
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
        mesh.castShadow = true;
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

    // The sky and lamp levels of the cell at a point in metres, read from the
    // floor under it. A point in mid-air or in a chunk not yet meshed takes
    // full sky above its column's surface and none below.
    lightAt(position)
    {
        const zone = this.zone;
        const [column, row] = zone.columnOf(position.x, position.z);
        const y = Math.floor(zone.cellY(position.y) + 0.01);

        return this.floorLight(column, y, row) ?? { sky: y >= zone.surface(column, row) ? 15 : 0, lamp: 0, glow: 0 };
    }

    // The levels of cell `y` when the cell under it is a floor, or null.
    floorLight(column, y, row)
    {
        const floor = y - 1;

        if(floor < 0) { return null; }

        const floors = this.floors.get(this.zone.chunkKey(Math.floor(column / CHUNK), Math.floor(floor / CHUNK), Math.floor(row / CHUNK)));
        const index = ((floor % CHUNK) * CHUNK + (row % CHUNK)) * CHUNK + (column % CHUNK);
        const found = floors ? ZoneView.search(floors.indices, index) : -1;

        return found < 0 ? null : { sky: floors.levels[found] >> 4, lamp: floors.levels[found] & 0xf, glow: floors.glows[found] };
    }

    static search(sorted, value)
    {
        let low = 0;
        let high = sorted.length - 1;

        while(low <= high)
        {
            const middle = (low + high) >> 1;

            if(sorted[middle] === value) { return middle; }
            if(sorted[middle] < value) { low = middle + 1; }
            else { high = middle - 1; }
        }

        return -1;
    }

    static joined(parts)
    {
        if(parts.length === 1) { return parts[0]; }

        const joined = {};
        let vertices = 0;

        for(const name of ["positions", "normals", "uvs", "layers", "colours", "lights", "weathers", "glows"])
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

    /* OBJECTS ****************************************************************/

    static objectGeometry(object, atlas, blocks)
    {
        const geometry = new THREE.BufferGeometry();
        const mesh = FineMesher.mesh(FineMesher.decode(object), (block) => blocks.block(blocks.number(block)).faces, atlas.uvPerMetre);

        geometry.setAttribute("position", new THREE.Float32BufferAttribute(mesh.positions, 3));
        geometry.setAttribute("normal", new THREE.Float32BufferAttribute(mesh.normals, 3));
        geometry.setAttribute("uv", new THREE.Float32BufferAttribute(mesh.uvs, 2));
        geometry.setAttribute("layer", new THREE.Float32BufferAttribute(mesh.layers.map((texture) => atlas.layer(mesh.textures[texture])), 1));
        geometry.setIndex(mesh.indices);
        geometry.computeBoundingSphere();
        geometry.userData.size = object.cells.map((count) => count / ZoneData.CUBES_PER_METRE);
        geometry.userData.lamp = object.lights ? blocks.light(blocks.number("objectLight")) - 1 : 0;

        return geometry;
    }

    // `size` is the object's cells in metres.
    static objectMatrix(entry, [width, , depth])
    {
        return new THREE.Matrix4().makeTranslation(entry.x, entry.y, entry.z)
            .multiply(new THREE.Matrix4().makeRotationY(entry.turns * Math.PI / 2))
            .multiply(new THREE.Matrix4().makeTranslation(-width / 2, 0, -depth / 2));
    }

    addObjects(name)
    {
        const placed = this.zone.objects.filter((entry) => entry.object && this.zone.regionOfColumn(entry.box[0], entry.box[2]) === name);
        const byKind = Map.groupBy(placed, (entry) => entry.object);

        for(const [kind, entries] of byKind)
        {
            const shared = this.objectGeometries.get(kind);

            if(!shared) { continue; }

            const geometry = shared.clone();
            const mesh = new THREE.InstancedMesh(geometry, this.materials.objects, entries.length);
            geometry.setAttribute("light", new THREE.InstancedBufferAttribute(new Float32Array(entries.length * 2), 2));
            geometry.setAttribute("glow", new THREE.InstancedBufferAttribute(new Float32Array(entries.length), 1));

            entries.forEach((entry, i) =>
            {
                mesh.setMatrixAt(i, ZoneView.objectMatrix(entry, shared.userData.size));
                this.objectSlots.set(entry, { mesh, index: i, entry, size: shared.userData.size });
            });

            mesh.name = "objects";
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.userData.entries = entries;
            mesh.computeBoundingSphere();
            this.objectMeshes.set(name + "/" + kind, mesh);
            this.scene.add(mesh);
        }
    }

    removeObjects(name)
    {
        for(const [key, mesh] of this.objectMeshes)
        {
            if(!key.startsWith(name + "/")) { continue; }

            for(const entry of mesh.userData.entries) { this.objectSlots.delete(entry); }

            mesh.geometry.dispose();
            mesh.dispose();
            this.scene.remove(mesh);
            this.objectMeshes.delete(key);
        }
    }

    // Each pose is a mover's slide `offset` in metres, or its `angle` about
    // `axis` through `pivot`, in metres from its lower corner, or through its
    // middle when `pivot` is null.
    poseMovers(poses)
    {
        const moved = new Set();

        for(const pose of poses)
        {
            const slot = this.objectSlots.get(pose.entry);

            if(!slot) { continue; }

            const matrix = ZoneView.objectMatrix(slot.entry, slot.size);

            if(pose.offset) { matrix.premultiply(new THREE.Matrix4().makeTranslation(...pose.offset)); }
            else
            {
                const pivot = new THREE.Vector3(...(pose.pivot ?? slot.size.map((metres) => metres / 2)));
                const axis = new THREE.Vector3(pose.axis === "x" ? 1 : 0, pose.axis === "y" ? 1 : 0, pose.axis === "z" ? 1 : 0);

                matrix.multiply(new THREE.Matrix4().makeTranslation(pivot.x, pivot.y, pivot.z))
                    .multiply(new THREE.Matrix4().makeRotationAxis(axis, pose.angle))
                    .multiply(new THREE.Matrix4().makeTranslation(-pivot.x, -pivot.y, -pivot.z));
            }

            slot.mesh.setMatrixAt(slot.index, matrix);
            moved.add(slot.mesh);
        }

        for(const mesh of moved)
        {
            mesh.instanceMatrix.needsUpdate = true;
            mesh.computeBoundingSphere();
        }
    }

    objectOf(mesh, index)
    {
        return mesh.userData.entries?.[index] ?? null;
    }

    // Each object takes the light of the cell above its top.
    lightObjects()
    {
        for(const mesh of this.objectMeshes.values())
        {
            const light = mesh.geometry.getAttribute("light");
            const glow = mesh.geometry.getAttribute("glow");
            let isChanged = false;

            mesh.userData.entries.forEach((entry, i) =>
            {
                const level = this.objectLight(entry);
                const [sky, lamp] = [level.sky / 15, level.lamp / 15];

                if(light.getX(i) === sky && light.getY(i) === lamp && glow.getX(i) === level.glow) { return; }

                light.setXY(i, sky, lamp);
                glow.setX(i, level.glow);
                isChanged = true;
            });

            if(isChanged)
            {
                light.needsUpdate = true;
                glow.needsUpdate = true;
            }
        }
    }

    // An object takes the light of the highest floor in its middle column, from
    // the cell above its top down to the floor under it, as the top of a column
    // may be open air with no floor under it. An object with lights takes at
    // least the lamp level beside them.
    objectLight(entry)
    {
        const [column, row] = this.zone.columnOf(entry.x, entry.z);
        const own = this.objectGeometries.get(entry.object).userData.lamp;
        let level = null;

        for(let y = entry.box[4] + 1; y >= Math.max(0, entry.box[1] - OBJECT_DROP) && !level; y--)
        {
            level = this.floorLight(column, y, row);
        }

        level ??= this.besideLight(entry.box);
        level ??= this.lightAt({ x: entry.x, y: this.zone.metresY(entry.box[4] + 1), z: entry.z });

        return { sky: level.sky, lamp: Math.max(level.lamp, own), glow: level.glow ?? 0 };
    }

    // An object that fills its middle column from floor to ceiling, such as a
    // door in its doorway, has no floor in that column, so it takes the
    // brightest floor in the columns around its box, or null.
    besideLight([x0, y0, z0, x1, y1, z1])
    {
        let best = null;

        for(let z = z0 - 1; z <= z1 + 1; z++)
        {
            for(let x = x0 - 1; x <= x1 + 1; x++)
            {
                if(x >= x0 && x <= x1 && z >= z0 && z <= z1) { continue; }

                for(let y = y0; y <= y1 + 1; y++)
                {
                    const level = this.floorLight(x, y, z);

                    if(level && (!best || level.sky + level.lamp > best.sky + best.lamp)) { best = level; }
                }
            }
        }

        return best;
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
        geometry.setAttribute("light", new THREE.BufferAttribute(arrays.lights, 2));
        geometry.setAttribute("weather", new THREE.BufferAttribute(arrays.weathers, 2));
        geometry.setAttribute("glow", new THREE.BufferAttribute(arrays.glows, 1));
        geometry.setIndex(new THREE.BufferAttribute(arrays.indices, 1));
        geometry.computeBoundingSphere();

        return geometry;
    }

    addSky(sky)
    {
        const geometry = new THREE.SphereGeometry(SKY_RADIUS, 16, 12);
        const position = geometry.getAttribute("position");

        geometry.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(position.count * 3), 3));

        this.sky = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
        this.sky.renderOrder = -2;
        this.paintSky(sky);

        this.moonDisc = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshBasicMaterial({ color: "#c8cdd6", fog: false, depthWrite: false }));
        this.moonDisc.position.set(...MOON_AT);
        this.moonDisc.lookAt(0, 0, 0);
        this.moonDisc.renderOrder = -1;
        this.sky.add(this.moonDisc);
        this.scene.add(this.sky);
    }

    paintSky({ top, horizon })
    {
        const position = this.sky.geometry.getAttribute("position");
        const colours = this.sky.geometry.getAttribute("color");
        const high = new THREE.Color(top);
        const low = new THREE.Color(horizon);

        for(let i = 0; i < position.count; i++)
        {
            const colour = low.clone().lerp(high, Math.pow(Math.max(0, position.getY(i) / SKY_RADIUS), 0.5));

            colours.setXYZ(i, colour.r, colour.g, colour.b);
        }

        colours.needsUpdate = true;
        this.scene.fog.color.set(horizon);
        this.scene.background.set(horizon);
    }

    // The zone's own lighting is its night.
    setDaylight(isDay)
    {
        const night = this.zone.lighting;
        const day = night.day ?? DAY;

        this.isDay = isDay;
        this.paintSky(isDay ? day.sky : night.sky);
        this.hemisphere.color.set(isDay ? day.hemisphere.sky : night.hemisphere.sky);
        this.hemisphere.groundColor.set(isDay ? day.hemisphere.ground : night.hemisphere.ground);
        this.hemisphere.intensity = isDay ? day.hemisphere.intensity : night.hemisphere.intensity;
        this.moon.color.set(isDay ? day.sun.colour : night.moon.colour);
        this.moon.intensity = isDay ? day.sun.intensity : night.moon.intensity;
        this.moonDisc.material.color.set(isDay ? "#fff6dc" : "#c8cdd6");
        this.moonDisc.position.set(...(isDay ? SUN_AT : MOON_AT));
        this.moonDisc.lookAt(0, 0, 0);
        this.materials.setSteps(isDay ? day.steps : night.steps);
    }

    /* LIGHTS *****************************************************************/

    addLights(lighting)
    {
        const { hemisphere, moon } = lighting;

        this.hemisphere = new THREE.HemisphereLight(hemisphere.sky, hemisphere.ground, hemisphere.intensity);
        this.scene.add(this.hemisphere);

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

    }

    /* FRAME ******************************************************************/

    update(delta, camera, focus)
    {
        this.focus = focus;
        this.materials.setPlayerLight(focus);
        this.meshWaiting();
        this.buildTiles();
        this.lightObjects();
        this.water.update(delta);
        this.sky.position.copy(camera.position);
        const disc = this.isDay ? SUN_AT : MOON_AT;
        const toLight = LIGHT_DISTANCE / Math.hypot(...disc);

        this.moon.position.set(focus.x + disc[0] * toLight, focus.y + disc[1] * toLight, focus.z + disc[2] * toLight);
        this.moon.target.position.copy(focus);
    }

    dispose()
    {
        this.unsubscribe();
        this.scene.traverse((node) =>
        {
            node.geometry?.dispose();

            if(node.material && node.material !== this.materials.world && node.material !== this.materials.terrain && node.material !== this.materials.objects && node.material !== this.materials.water) { node.material.dispose(); }
        });

        this.moon.shadow.map?.dispose();
        this.scene.clear();
        this.isDisposed = true;
    }
}
