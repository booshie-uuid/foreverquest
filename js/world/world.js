import * as Props from "./props.js";
import * as THREE from "three";
import { PropBuilder } from "./prop-builder.js";
import { Random } from "../util/random.js";
import { Terrain } from "./terrain.js";
import { Water } from "./water.js";

const SKY_TOP = "#0e1118";
const SKY_HORIZON = "#262b34";
const SHADOW_RANGE = 26;
const MAX_STEP_UP = 0.5;

const HOUSES =
[
    { angle: -0.79, radius: 12, style: { width: 5, depth: 4, roof: "slate", isLit: true, sign: true } },
    { angle: -2.44, radius: 12, style: { width: 4.4, depth: 4, roof: "thatch", isLit: false } },
    { angle: 2.18, radius: 12, style: { width: 5.2, depth: 4.2, roof: "slate", isLit: true } },
    { angle: 0.96, radius: 12, style: { width: 4.6, depth: 3.8, roof: "thatch", isLit: false } },
];


/******************************************************************************/
/* WORLD                                                                      */
/******************************************************************************/

export class World
{
    constructor(materials, seed = 7)
    {
        this.materials = materials;
        this.seed = seed;
        this.scene = new THREE.Scene();
        this.terrain = new Terrain(seed);
        this.water = new Water(this.terrain.size, 48, Terrain.WATER_LEVEL - 0.05, materials.water);
        this.colliders = [];
        this.lightSpots = [];
        this.time = 0;

        this.scene.fog = new THREE.Fog(SKY_HORIZON, 14, 58);
        this.scene.background = new THREE.Color(SKY_HORIZON);
        this.terrainMesh = this.terrain.buildMesh(materials.world, materials.atlas);
        this.scene.add(this.terrainMesh, this.water.mesh);

        this.addSky();
        this.addProps();
        this.addLights();
    }

    /* SETUP ******************************************************************/

    addSky()
    {
        const geometry = new THREE.SphereGeometry(300, 16, 12);
        const position = geometry.getAttribute("position");
        const top = new THREE.Color(SKY_TOP);
        const horizon = new THREE.Color(SKY_HORIZON);
        const colours = [];

        for(let i = 0; i < position.count; i++)
        {
            const colour = horizon.clone().lerp(top, Math.pow(Math.max(0, position.getY(i) / 300), 0.5));

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

    addLights()
    {
        this.scene.add(new THREE.HemisphereLight("#6a7488", "#221b14", 1.5));

        this.moon = new THREE.DirectionalLight("#a8b8d8", 1.7);
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

        for(const spot of this.lightSpots)
        {
            const light = new THREE.PointLight("#ff9a40", 5, 8, 1.6);

            light.position.set(...spot);
            this.scene.add(light);
        }
    }

    addProps()
    {
        const random = new Random(this.seed * 31 + 5);
        const builder = new PropBuilder(this.materials.atlas);

        this.addVillage(builder, random);
        this.addChapelGrounds(builder, random);
        this.addWilds(builder, random);

        const mesh = new THREE.Mesh(builder.build(), this.materials.world);

        mesh.name = "props";
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.scene.add(mesh);
    }

    addVillage(builder, random)
    {
        const height = (x, z) => this.terrain.heightAt(x, z);
        const add = (result) =>
        {
            this.colliders.push(result.collider ?? result);
            this.lightSpots.push(...(result.lights ?? []));

            if(result.light) { this.lightSpots.push(result.light); }
        };

        add(Props.well(builder, 0, height(0, 0), 0));
        add(Props.stocks(builder, 3.6, height(3.6, -3.4), -3.4, 0.5));

        for(const angle of [0.4, 1.95, 3.55, 5.1])
        {
            const x = Math.cos(angle) * 6.6;
            const z = Math.sin(angle) * 6.6;

            add(Props.lampPost(builder, x, height(x, z), z, -angle));
        }

        for(const { angle, radius, style } of HOUSES)
        {
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;

            add(Props.house(builder, x, height(x, z), z, Math.atan2(-x, -z), style));
            add(Props.barrel(builder, x + Math.cos(angle + 0.6) * -3.4, height(x, z), z + Math.sin(angle + 0.6) * -3.4, random.range(0, 1)));
        }

        add(Props.cottage(builder, 13.6, height(13.6, -2.4), -2.4, Math.atan2(-13.6, 2.4)));
        add(Props.cottage(builder, -13.2, height(-13.2, -4.8), -4.8, Math.atan2(13.2, 4.8)));
        add(Props.cart(builder, -4.4, height(-4.4, 4.6), 4.6, 0.7));
        add(Props.sacks(builder, -6.2, height(-6.2, 3.2), 3.2, 0.4));

        for(const [x, z, size] of [[5.2, -6.8, 0.7], [5.9, -6.2, 0.55], [-7.2, -3.2, 0.65], [-7.6, -2.5, 0.5]])
        {
            add(Props.crate(builder, x, height(x, z), z, size, random.range(0, 1)));
        }

        add(Props.signpost(builder, -14.5, height(-14.5, 3.6), 3.6, 0.3));
        add(Props.gibbet(builder, -25, height(-25, 7.5), 7.5, 1.2));
        this.colliders.push(...Props.fence(builder, [[-18, 12], [-12, 18], [-6, 20], [-2, 24]], height));
    }

    addChapelGrounds(builder, random)
    {
        const height = (x, z) => this.terrain.heightAt(x, z);
        const chapel = Props.chapel(builder, -9, height(-9, -22), -22, 0);

        this.colliders.push(chapel.collider);
        this.lightSpots.push(...chapel.lights);

        for(let row = 0; row < 3; row++)
        {
            for(let column = 0; column < 4; column++)
            {
                if(random.chance(0.2)) { continue; }

                const x = 1.5 + column * 1.6 + random.range(-0.2, 0.2);
                const z = -18 - row * 2.4 + random.range(-0.2, 0.2);

                this.colliders.push(Props.grave(builder, x, height(x, z), z, random.range(-0.15, 0.15), random));
            }
        }

        this.colliders.push(...Props.fence(builder, [[0, -15.5], [8.5, -15.5], [8.5, -25.5], [0, -25.5]], height));
        this.colliders.push(Props.deadTree(builder, 7, height(7, -27.5), -27.5, 1.2, random));
    }

    addWilds(builder, random)
    {
        const terrain = this.terrain;

        for(let i = 0; i < 900; i++)
        {
            const x = random.range(-44, 44);
            const z = random.range(-44, 44);
            const y = terrain.heightAt(x, z);
            const isForest = Math.hypot(x + 26, z + 24) < 16 || Math.hypot(x - 30, z + 28) < 12;
            const odds = isForest ? 0.55 : y > 1.5 ? 0.12 : 0.05;

            if(Math.hypot(x, z) < 19 || terrain.isWater(x, z) || Terrain.pathDistance(x, z) < 2) { continue; }
            if(!random.chance(odds) || this.isCrowded(x, z, 1.4)) { continue; }

            const roll = random.next();
            const scale = random.range(0.8, 1.3);

            if(roll < 0.62)
            {
                this.colliders.push(Props.pine(builder, x, y, z, scale, random));
            }
            else if(roll < 0.82)
            {
                this.colliders.push(Props.deadTree(builder, x, y, z, scale, random));
            }
            else
            {
                this.colliders.push(Props.oak(builder, x, y, z, scale, random));
            }
        }

        for(let i = 0; i < 160; i++)
        {
            const x = random.range(-44, 44);
            const z = random.range(-44, 44);
            const y = terrain.heightAt(x, z);

            if(Math.hypot(x, z) < 8 || terrain.isWater(x, z) || Terrain.pathDistance(x, z) < 1.4 || this.isCrowded(x, z, 1)) { continue; }

            const roll = random.next();

            if(roll < 0.3)
            {
                this.colliders.push(Props.rock(builder, x, y, z, random.range(0.5, 1.4), random));
            }
            else if(roll < 0.55)
            {
                Props.bush(builder, x, y, z, random.range(0.8, 1.3), random);
            }
            else
            {
                Props.weeds(builder, x, y, z, random);
            }
        }
    }

    isCrowded(x, z, gap)
    {
        return this.colliders.some((collider) => Math.hypot(collider.x - x, collider.z - z) < gap + (collider.radius ?? Math.max(collider.halfWidth, collider.halfDepth)));
    }

    /* QUERIES ****************************************************************/

    heightAt(x, z)
    {
        return this.terrain.heightAt(x, z);
    }

    isWalkable(x, z)
    {
        return this.terrain.isInside(x, z, 2) && !this.terrain.isWater(x, z);
    }

    canStep(from, to)
    {
        return this.isWalkable(to.x, to.z) && this.heightAt(to.x, to.z) - this.heightAt(from.x, from.z) <= MAX_STEP_UP;
    }

    resolveStep(from, to, radius)
    {
        const result = { x: to.x, z: to.z };

        for(let pass = 0; pass < 2; pass++)
        {
            for(const collider of this.colliders)
            {
                if(collider.radius !== undefined)
                {
                    World.pushOutOfCircle(result, collider, radius);
                }
                else
                {
                    World.pushOutOfBox(result, collider, radius);
                }
            }
        }

        if(!this.canStep(from, result)) { return { x: from.x, z: from.z }; }

        return result;
    }

    static pushOutOfCircle(point, circle, radius)
    {
        const dx = point.x - circle.x;
        const dz = point.z - circle.z;
        const distance = Math.hypot(dx, dz);
        const minimum = circle.radius + radius;

        if(distance >= minimum || distance === 0) { return; }

        point.x = circle.x + (dx / distance) * minimum;
        point.z = circle.z + (dz / distance) * minimum;
    }

    static pushOutOfBox(point, box, radius)
    {
        const cos = Math.cos(box.angle);
        const sin = Math.sin(box.angle);
        const dx = point.x - box.x;
        const dz = point.z - box.z;
        const localX = dx * cos - dz * sin;
        const localZ = dx * sin + dz * cos;
        const halfWidth = box.halfWidth + radius;
        const halfDepth = box.halfDepth + radius;

        if(Math.abs(localX) >= halfWidth || Math.abs(localZ) >= halfDepth) { return; }

        const pushX = halfWidth - Math.abs(localX);
        const pushZ = halfDepth - Math.abs(localZ);
        let newX = localX;
        let newZ = localZ;

        if(pushX < pushZ)
        {
            newX = Math.sign(localX || 1) * halfWidth;
        }
        else
        {
            newZ = Math.sign(localZ || 1) * halfDepth;
        }

        point.x = box.x + newX * cos + newZ * sin;
        point.z = box.z - newX * sin + newZ * cos;
    }

    /* FRAME ******************************************************************/

    update(delta, camera, focus)
    {
        this.time += delta;
        this.water.update(delta);
        this.sky.position.copy(camera.position);
        this.moon.position.set(focus.x - 20, focus.y + 40, focus.z + 14);
        this.moon.target.position.copy(focus);
    }
}
