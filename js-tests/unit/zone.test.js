import * as Pathfinder from "../../js/sim/pathfinder.js";
import * as RegionCodec from "../../js/sim/region-codec.js";
import * as THREE from "three";
import * as Terrain from "../../tools/bake/terrain.js";
import * as TestAssets from "../helpers/assets.js";
import * as Voxelise from "../../tools/bake/voxelise.js";
import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BlockSet } from "../../js/sim/block-set.js";
import { ZoneView } from "../../js/render/zone-view.js";

const hearthmere = await TestAssets.zone("hearthmere");
const testfield = await TestAssets.zone("testfield");
const materials = await TestAssets.materials();

describe("Zone cells", () =>
{
    it("rises and falls in whole cubes, with each column solid up to its surface", () =>
    {
        const blocks = hearthmere.blocks;

        for(let i = 0; i < 400; i++)
        {
            const [x, z] = [-47 + (i % 20) * 4.7, -47 + Math.floor(i / 20) * 4.7];
            const [column, row] = hearthmere.columnOf(x, z);
            const surface = hearthmere.surface(column, row);
            const height = hearthmere.heightAt(x, z);

            assert.ok(Math.abs(height * 3 - Math.round(height * 3)) < 1e-9, "Height " + height);
            assert.ok(hearthmere.isSolid(column, surface - 1, row) && hearthmere.isSolid(column, 0, row), x + ", " + z);
            assert.equal(blocks.isSolid(hearthmere.blockAt(column, surface, row)), false, x + ", " + z);
        }
    });

    it("keeps the village square flat and dry, builds the well on it and floods the river", () =>
    {
        for(const [x, z] of [[-12, -14], [4, 2], [-10, 0], [6, -12]]) { assert.equal(hearthmere.groundAt(x, z), 2 / 3, x + ", " + z); }

        const [column, row] = hearthmere.columnOf(-3, -6);
        const wellFoot = hearthmere.blockAt(column, hearthmere.cellY(hearthmere.groundAt(-3, -6)), row);

        assert.ok(hearthmere.blocks.isSolid(wellFoot), "The well has no cube on the ground");
        assert.ok(hearthmere.heightAt(-3, -6) > hearthmere.groundAt(-3, -6));
        assert.equal(hearthmere.isWater(0, 0), false);
        assert.ok(hearthmere.isWater(54.6, -30), "The river is dry");
        assert.equal(hearthmere.blockAt(-1, 20, 0), BlockSet.AIR);
    });
});

describe("Region files", () =>
{
    it("keep uniform chunks as one block, leave air out, and keep layered and mixed chunks whole", () =>
    {
        const dense = new Uint8Array(RegionCodec.CELLS).map((value, i) => i % 7);
        const layered = new Uint8Array(RegionCodec.CELLS).map((value, i) => (i < 20 * 1024 ? 4 : 0));
        const region =
        {
            width: 40,
            depth: 32,
            height: 64,
            surfaces: Uint16Array.from({ length: 40 * 32 }, (value, i) => i % 65),
            grounds: Uint16Array.from({ length: 40 * 32 }, (value, i) => i % 13),
            ages: Uint8Array.from({ length: 40 * 32 }, (value, i) => i % 101),
            chunks:
            [
                { x: 0, y: 0, z: 0, cells: new Uint8Array(RegionCodec.CELLS).fill(3) },
                { x: 1, y: 0, z: 0, cells: dense },
                { x: 0, y: 1, z: 0, cells: new Uint8Array(RegionCodec.CELLS) },
                { x: 1, y: 1, z: 0, cells: layered },
            ],
        };
        const encoded = RegionCodec.encode(region);
        const decoded = RegionCodec.decode(encoded);

        assert.deepEqual([decoded.width, decoded.depth, decoded.height], [40, 32, 64]);
        assert.deepEqual([decoded.surfaces, decoded.grounds, decoded.ages], [region.surfaces, region.grounds, region.ages]);
        assert.deepEqual(decoded.chunks.map((chunk) => [chunk.x, chunk.y, chunk.z, chunk.uniform]), [[0, 0, 0, 3], [1, 0, 0, null], [1, 1, 0, null]]);
        assert.deepEqual(decoded.chunks[1].cells, dense);
        assert.deepEqual(decoded.chunks[2].cells, layered);
        assert.ok(encoded.length < 12 + 40 * 32 * 5 + 2 + 4 + 1 + 4 + RegionCodec.CELLS + 4 + 100, "A layered chunk is stored as runs");
    });

    it("tops each column with its ground, then subsoil, then rock, and fills water to the water line", () =>
    {
        const zone = { columns: 32, height: 32, base: 4, water: 6 };
        const surfaces = new Uint16Array(32 * 32).fill(10);
        const grounds = new Uint8Array(32 * 32);

        surfaces[0] = 3;
        surfaces[5] = 20;

        const region = Terrain.composeRegion(zone, { surfaces, grounds }, [{ top: 1, under: 2 }], { rock: 9, water: 8 }, 0, 0);
        const cell = (x, y, z) => region.chunks[0].cells[(y * 32 + z) * 32 + x];

        assert.deepEqual([10, 9, 8, 7, 6, 5].map((y) => cell(10, y, 10)), [0, 1, 2, 2, 2, 9]);
        assert.deepEqual([2, 3, 4, 5, 6].map((y) => cell(0, y, 0)), [1, 8, 8, 8, 0]);
        assert.deepEqual([9, 8].map((y) => cell(1, y, 0)), [1, 9], "The face of a drop of more than four cubes is rock");
        assert.deepEqual([19, 18].map((y) => cell(5, y, 0)), [1, 9], "High ground is rock under its top");
        assert.equal(region.surfaces[5], 20);
    });
});

describe("Zone movement", () =>
{
    it("stops a move into the well, into the river, and up two cubes", () =>
    {
        const intoWell = hearthmere.resolveMove({ x: -4, y: hearthmere.groundAt(-4, -3.8), z: -3.8 }, { x: -4, z: -4.6 }, 0.35);
        let shoreX = 40;

        while(!hearthmere.isWater(shoreX + 1, -30)) { shoreX += 0.25; }

        const shore = { x: shoreX, y: hearthmere.heightAt(shoreX, -30), z: -30 };
        const intoRiver = hearthmere.resolveMove(shore, { x: shoreX + 3, z: -30 }, 0.35);

        assert.deepEqual([intoWell.x, intoWell.z], [-4, -3.8]);
        assert.equal(intoRiver.x, shoreX, "The move went into the river");

        for(let x = -40; x < 40; x++)
        {
            for(let z = -40; z < 40; z++)
            {
                const from = { x: x + 0.5, y: hearthmere.heightAt(x + 0.5, z + 0.5), z: z + 0.5 };
                const step = hearthmere.heightAt(x + 1.5, z + 0.5) - from.y;

                if(step > 0.5 && hearthmere.isWalkable(x + 1.5, z + 0.5))
                {
                    assert.equal(hearthmere.footingAt(x + 1.5, z + 0.5, from.y, 0.35), null);

                    return;
                }
            }
        }

        assert.fail("The zone has no rise of two cubes to test");
    });

    it("lets a route lead through a kit house's door into its room, which has a ceiling 9 cubes up", async () =>
    {
        const expanse = await TestAssets.zone("expanse");
        const from = expanse.openGround(-1.17, 22, 0.35);
        const path = Pathfinder.find(expanse, from, { x: -1.17, z: 15 }, 0.35);
        const end = path.at(-1);
        const floor = expanse.standAt(end.x, end.z, expanse.groundAt(end.x, end.z) + 1, 0.35).floor;
        const up = { x: 0, y: 1, z: 0 };

        assert.deepEqual(end, { x: -1.17, z: 15 });
        assert.ok(Math.abs(expanse.raycast({ x: end.x, y: floor + 0.01, z: end.z }, up, 10) - 3) < 0.02, "The ceiling is not 3 metres up");
        assert.equal(expanse.raycast({ x: from.x, y: from.y + 1.7, z: from.z }, up, 10), 10);
    });

    it("names the placed object a cell belongs to, the smallest when boxes overlap", () =>
    {
        const named = (name) => hearthmere.objects.find((object) => object.name === name);
        const [column, row] = hearthmere.columnOf(-12, -24);
        const inn = hearthmere.objectAt(column, hearthmere.cellY(hearthmere.groundAt(-12, -24)) + 4, row);
        const altar = named("object altar");
        const inside = hearthmere.objectAt(altar.box[0], altar.box[1], altar.box[2]);

        assert.deepEqual([inn?.prop, inn?.name, inn?.turns], [named("inn").prop, "inn", 1]);
        assert.deepEqual([inside?.prop, inside?.name], [altar.prop, "object altar"], "The chapel's box was chosen over the altar's");
        assert.equal(named("chapel").prop, 0);
        assert.equal(hearthmere.objectAt(0, 0, 0), null);
    });

    it("ages each column by the zone, or by the prefab placed over it", () =>
    {
        const chapel = hearthmere.objects.find((object) => object.name === "chapel");
        const [x0, , z0, x1, , z1] = chapel.box;

        assert.equal(hearthmere.age(...hearthmere.columnOf(0, 0)), 30);
        assert.equal(hearthmere.age((x0 + x1) >> 1, (z0 + z1) >> 1), 60);
        assert.equal(testfield.age(0, 0), 0);
    });

    it("stands every placed prefab on a cube corner", () =>
    {
        const placed = hearthmere.objects.filter((object) => !object.object && !object.name.startsWith("run "));

        assert.ok(placed.length > 100);
        assert.ok(placed.every(({ x, z }) => Math.abs(x * 3 - Math.round(x * 3)) < 1e-9 && Math.abs(z * 3 - Math.round(z * 3)) < 1e-9));
    });

    it("places entities on open ground beside the props", () =>
    {
        const spot = hearthmere.openGround(-4, -6, 0.35);

        assert.ok(Math.hypot(spot.x + 4, spot.z + 6) > 1, JSON.stringify(spot));
        assert.equal(spot.y, hearthmere.groundAt(spot.x, spot.z));
    });
});

describe("Zone props", () =>
{
    const zone = { columns: 96, height: 64, base: 16 };
    const count = (cells) => [...cells.values()].filter((block) => block === 1).length;

    it("fills the cells whose centres a block covers, and at least one cell across a thin block", () =>
    {
        const box = new Map();
        const post = new Map();

        Voxelise.rasterise(box, zone, { size: [1, 1, 1], at: [0.5, 0.5, 0.5] }, 1);
        Voxelise.rasterise(post, zone, { size: [0.05, 1, 0.05], at: [0.1, 0.5, 0.1] }, 1);

        assert.equal(count(box), 27);
        assert.equal(count(post), 3);
    });

    it("turns a block with its prefab and snaps placements to quarter turns", () =>
    {
        const along = new Map();
        const turned = new Map();

        Voxelise.rasterise(along, zone, { size: [2, 1 / 3, 1 / 3], at: [0, 1 / 6, 1 / 6] }, 1);
        Voxelise.rasterise(turned, zone, { size: [2, 1 / 3, 1 / 3], at: [1 / 6, 1 / 6, 0], rotation: [0, Math.PI / 2, 0] }, 1);

        assert.equal(count(along), 6);
        assert.equal(count(turned), 6);
        assert.ok([...turned.keys()].every((index) => index % 96 === 48), "The turned block does not run along z");
        assert.equal(Voxelise.quarterTurn(0.8), Math.PI / 2);
        assert.equal(Voxelise.quarterTurn(0.3), 0);
    });

    it("carves a room and its door, and lays steps from the sill down to the ground", () =>
    {
        const cells = new Map();
        const ground = () => 16;

        Voxelise.rasterise(cells, zone, { size: [3, 3, 3], at: [0, 1.5, 0] }, 1);
        Voxelise.carve(cells, zone, { size: [2, 2, 2], at: [0, 1.7, 0] });
        Voxelise.carve(cells, zone, { size: [1, 2, 0.8], at: [0, 1.7, 1.5] });
        Voxelise.addSteps(cells, zone, { size: [1, 2, 0.8], at: [0, 1.7, 1.5] }, 0, ground, 2);

        const at = (x, y, z) => cells.get((y * 96 + z) * 96 + x);
        const sill = Math.round(0.7 * 3 + 16);

        assert.equal(at(48, sill, 48), 0, "The room was not carved");
        assert.equal(at(48, sill, 52), 0, "The door was not carved");
        assert.equal(at(48, sill - 1, 52), 1, "The sill went with the door");
        assert.deepEqual([at(48, sill - 2, 54), at(48, sill - 1, 54)], [2, 0]);
        assert.deepEqual([at(48, 16, 55), at(48, 17, 55)], [undefined, undefined], "A step went below the ground");
    });

    it("keeps a wall thinner than a cube when a room is carved inside it", () =>
    {
        const cells = new Map();
        const carved = new Map();

        Voxelise.rasterise(cells, zone, { size: [3, 2, 3], at: [0.1, 1, 0.1] }, 1);
        Voxelise.carve(cells, zone, { size: [2.8, 1.6, 2.8], at: [0.1, 1, 0.1] }, carved);
        Voxelise.keepShell(cells, zone, carved, () => 16);

        const ring = [];

        for(let x = 40; x < 56; x++)
        {
            for(let z = 40; z < 56; z++)
            {
                if(cells.get((19 * 96 + z) * 96 + x) === 1) { ring.push([x, z]); }
            }
        }

        const xs = ring.map(([x]) => x);
        const zs = ring.map(([, z]) => z);
        const [minX, maxX, minZ, maxZ] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
        const isClosed = (x, z) => cells.get((19 * 96 + z) * 96 + x) === 1;

        assert.ok(minX < 48 && maxX > 48 && minZ < 48 && maxZ > 48, "No wall stands around the room");

        for(let x = minX; x <= maxX; x++) { assert.ok(isClosed(x, minZ) && isClosed(x, maxZ), "The wall has a gap at x " + x); }
        for(let z = minZ; z <= maxZ; z++) { assert.ok(isClosed(minX, z) && isClosed(maxX, z), "The wall has a gap at z " + z); }

        assert.equal(cells.get((19 * 96 + 48) * 96 + 48), 0, "The room was not carved");
    });

    it("builds the test field's props as cubes", () =>
    {
        const [poleColumn, poleRow] = testfield.columnOf(3, -3);

        assert.ok(testfield.heightAt(-8, -8) > testfield.groundAt(-8, -8) + 3, "The pine is missing");
        assert.ok(testfield.heightAt(3, -3) > testfield.groundAt(3, -3) + 2, "The lamp post is missing");
        assert.ok(testfield.isSolid(poleColumn, testfield.surface(poleColumn, poleRow) - 1, poleRow));
        assert.ok(testfield.heightAt(-2, 11) > testfield.groundAt(-2, 11), "The fence post is missing");
    });
});

describe("Zone view", () =>
{
    it("draws a top face over every column, in tiles of two by two chunks", () =>
    {
        const view = new ZoneView(hearthmere, materials);
        const area = view.terrainMeshes.reduce((total, mesh) =>
        {
            const normal = mesh.geometry.getAttribute("normal");
            const position = mesh.geometry.getAttribute("position");
            let sum = 0;

            for(let i = 0; i < normal.count; i += 4)
            {
                if(normal.getY(i) === 1) { sum += Math.abs((position.getX(i + 1) - position.getX(i)) * (position.getZ(i + 3) - position.getZ(i))); }
            }

            return total + sum;
        }, 0);

        assert.equal(view.terrainMeshes.length, 9 * 9);
        assert.ok(area >= 192 * 192 - 1e-6, "The tops cover only " + area + " square metres");
        view.dispose();
    });

    it("gives a character the light of the cell it stands in: full sky outside, less inside the inn, lamp light under a lantern", () =>
    {
        const view = new ZoneView(hearthmere, materials);
        const street = view.lightAt({ x: -8, y: hearthmere.groundAt(-8, 0), z: 0 });
        const lantern = hearthmere.objects.find((object) => object.object === "lantern" && Math.abs(object.x + 12) < 3 && Math.abs(object.z + 24) < 3 && object.y < 4);
        const room = view.lightAt({ x: lantern.x, y: hearthmere.groundAt(lantern.x, lantern.z), z: lantern.z });

        assert.equal(street.sky, 15);
        assert.ok(room.sky < street.sky - 2, "The room is as bright as the street: " + JSON.stringify(room));
        assert.ok(room.lamp >= 4, "The inn's lantern does not light the floor under it: " + JSON.stringify(room));
        assert.deepEqual(view.lightAt({ x: 0, y: 40, z: 0 }), { sky: 15, lamp: 0 });
        view.dispose();
    });

    it("sets the zone's height fog, and adds it to the fog of every material that draws the world", () =>
    {
        const view = new ZoneView(hearthmere, materials);
        const character = new THREE.MeshLambertMaterial();
        const patched = (material, library) =>
        {
            const shader = { uniforms: {}, vertexShader: THREE.ShaderLib[library].vertexShader, fragmentShader: THREE.ShaderLib[library].fragmentShader };

            material.onBeforeCompile(shader);

            return shader;
        };

        materials.shadeCharacter(character, { cellSky: { value: new THREE.Color() }, cellLamp: { value: new THREE.Color() } });

        for(const [material, library] of [[materials.terrain, "lambert"], [materials.objects, "lambert"], [character, "lambert"], [materials.water, "phong"]])
        {
            const shader = patched(material, library);

            assert.ok(shader.fragmentShader.includes("fogHeight") && !shader.fragmentShader.includes("#include <fog_fragment>"), library + " fog was not replaced");
            assert.ok(shader.vertexShader.includes("vFogWorld ="));
            assert.equal(shader.uniforms.heightFog, materials.fog.heightFog);
        }

        assert.deepEqual(materials.fog.heightFog.value.toArray().slice(0, 3).map((value) => Math.round(value * 1e6) / 1e6), [0.8, 1.5, 0.02]);
        view.dispose();
        new ZoneView(testfield, materials).dispose();
        assert.equal(materials.fog.heightFog.value.z, 0, "A zone without height fog kept the last zone's");
    });

    it("shines the moon, and by day the sun, from where its disc stands in the sky", () =>
    {
        const view = new ZoneView(testfield, materials);
        const camera = { position: view.sky.position.clone() };
        const along = () =>
        {
            const light = view.moon.position.clone().sub(view.moon.target.position).normalize();
            const disc = view.moonDisc.position.clone().normalize();

            return light.dot(disc);
        };

        view.update(0.016, camera, { x: 3, y: 1, z: -2 });

        const night = along();

        view.setDaylight(true);
        view.update(0.016, camera, { x: 3, y: 1, z: -2 });

        assert.ok(night > 0.9999, "The moonlight does not come from the moon");
        assert.ok(along() > 0.9999, "The sunlight does not come from the sun");
        view.dispose();
    });

    it("frees its geometry when disposed, and leaves the shared materials alone", () =>
    {
        const view = new ZoneView(testfield, materials);
        const geometries = view.terrainMeshes.map((mesh) => mesh.geometry);
        const disposed = new Set();
        let isWorldDisposed = false;

        for(const geometry of geometries) { geometry.addEventListener("dispose", () => disposed.add(geometry)); }

        materials.world.addEventListener("dispose", () => { isWorldDisposed = true; });
        view.dispose();

        assert.equal(disposed.size, geometries.length);
        assert.equal(isWorldDisposed, false);
        assert.equal(view.scene.children.length, 0);
    });
});
