import * as THREE from "three";

const RADIUS = 0.53;
const FOG_GROWTH = 1.6;
const FOG_DIMMING = 0.3;
const MAX_ANGLE = 0.3;
const STRENGTH = 1;
const FADE_FROM = 0.85;
const GAP = 0.05;
const MAX_LEVEL = 15;
const FIRST_CAPACITY = 64;
const CHECK_FRAMES = 4;
const CLUSTER = 0.6;
const FADE_SECONDS = 0.2;

const VERTEX = `
attribute vec3 centre;
attribute vec3 colour;
attribute vec2 size;
varying vec2 vAcross;
varying vec3 vColour;
varying float vFog;

void main()
{
    vec4 view = viewMatrix * vec4(centre, 1.0);

    view.xy += position.xy * 2.0 * size.x;
    vAcross = position.xy * 2.0;
    vColour = colour;
    vFog = size.y;
    gl_Position = projectionMatrix * view;
}
`;

const FRAGMENT = `
varying vec2 vAcross;
varying vec3 vColour;
varying float vFog;

void main()
{
    float away = length(vAcross);

    if(away >= 1.0) { discard; }

    float middle = 0.5 + vFog * 0.2;
    float inner = 0.16 + vFog * 0.14;
    float strength = away < 0.35 ? mix(middle, inner, away / 0.35) : mix(inner, 0.0, (away - 0.35) / 0.65);

    gl_FragColor = vec4(vColour, strength);
}
`;

// The shader writes its colours unconverted, so they add in sRGB.
export class Halos
{
    constructor(zone)
    {
        this.zone = zone;
        this.spots = new Float32Array(0);
        this.mesh = new THREE.Mesh(undefined, new THREE.ShaderMaterial({ vertexShader: VERTEX, fragmentShader: FRAGMENT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        this.mesh.name = "halos";
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = 1;
        this.scratch = { spot: new THREE.Vector3(), toCamera: new THREE.Vector3(), inView: new THREE.Vector3() };
        this.shown = new Float32Array(0);
        this.isSeen = new Uint8Array(0);
        this.nextCheck = 0;

        const walls = Uint8Array.from({ length: zone.blocks.count + 1 }, (unused, block) => (zone.blocks.isOpaque(block) && zone.blocks.light(block) === 0 ? 1 : 0));
        const panes = walls.map((isWall, block) => (isWall === 1 || zone.blocks.block(block)?.kind === "glass" ? 1 : 0));

        this.isWall = (x, y, z) => walls[zone.blockAt(x, y, z)] === 1;
        this.isWallOrPane = (x, y, z) => panes[zone.blockAt(x, y, z)] === 1;
        this.allocate(FIRST_CAPACITY);
    }

    // `spots` holds [x, y, z, colour, level] for each light, as the mesher
    // gives them.
    setSpots(spots)
    {
        spots = Halos.clustered(spots);
        this.spots = spots;
        this.shown = new Float32Array(spots.length / 5).fill(-1);
        this.isSeen = new Uint8Array(spots.length / 5);

        if(spots.length / 5 > this.capacity) { this.allocate(spots.length / 5); }
    }

    // Lights of one colour within CLUSTER metres of each other, in a chain,
    // become one light at their middle at the level of the brightest, as
    // their halos would otherwise add up.
    static clustered(spots)
    {
        const count = spots.length / 5;
        const parent = Array.from({ length: count }, (unused, i) => i);
        const rootOf = (i) =>
        {
            while(parent[i] !== i) { i = parent[i] = parent[parent[i]]; }

            return i;
        };

        for(let a = 0; a < count; a++)
        {
            for(let b = a + 1; b < count; b++)
            {
                const isNear = Math.hypot(spots[a * 5] - spots[b * 5], spots[a * 5 + 1] - spots[b * 5 + 1], spots[a * 5 + 2] - spots[b * 5 + 2]) <= CLUSTER;

                if(isNear && spots[a * 5 + 3] === spots[b * 5 + 3]) { parent[rootOf(a)] = rootOf(b); }
            }
        }

        const groups = Map.groupBy(Array.from({ length: count }, (unused, i) => i), rootOf);

        return Float32Array.from([...groups.values()].flatMap((members) =>
        {
            const middle = (axis) => members.reduce((total, i) => total + spots[i * 5 + axis], 0) / members.length;

            return [middle(0), middle(1), middle(2), spots[members[0] * 5 + 3], Math.max(...members.map((i) => spots[i * 5 + 4]))];
        }));
    }

    // A new geometry each time, as Three.js keeps the instance count a
    // geometry was first drawn with as the most it will draw.
    allocate(count)
    {
        const geometry = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(1, 1));

        for(const [name, size] of [["centre", 3], ["colour", 3], ["size", 2]])
        {
            geometry.setAttribute(name, new THREE.InstancedBufferAttribute(new Float32Array(count * size), size).setUsage(THREE.DynamicDrawUsage));
        }

        geometry.instanceCount = 0;
        this.geometry?.dispose();
        this.geometry = geometry;
        this.mesh.geometry = geometry;
        this.capacity = count;
    }

    get count()
    {
        return this.geometry.instanceCount;
    }

    // `fog` is the scene's Fog and `heightFog` { base, falloff, density }.
    update(delta, camera, fog, heightFog)
    {
        const centres = this.geometry.getAttribute("centre");
        const colours = this.geometry.getAttribute("colour");
        const sizes = this.geometry.getAttribute("size");
        const { spot, toCamera } = this.scratch;
        const lights = this.spots.length / 5;
        const checks = Math.ceil(lights / CHECK_FRAMES);
        let count = 0;

        camera.updateMatrixWorld();

        for(let light = 0; light < lights; light++)
        {
            const i = light * 5;

            spot.set(this.spots[i], this.spots[i + 1], this.spots[i + 2]);

            const distance = spot.distanceTo(camera.position);

            if(distance >= fog.far) { continue; }

            toCamera.subVectors(camera.position, spot).normalize();

            if(this.shown[light] < 0 || (light - this.nextCheck + lights) % lights < checks) { this.isSeen[light] = this.zone.raycast(spot, toCamera, distance, this.isWall) >= distance ? 1 : 0; }

            this.shown[light] = this.shown[light] < 0 ? this.isSeen[light] : THREE.MathUtils.clamp(this.shown[light] + (this.isSeen[light] === 1 ? 1 : -1) * delta / FADE_SECONDS, 0, 1);

            if(this.shown[light] === 0) { continue; }

            const fogged = this.fogBetween(camera, spot, fog, heightFog);
            const radius = Math.min(RADIUS + FOG_GROWTH * fogged, distance * MAX_ANGLE);
            const strength = this.shown[light] * (1 - THREE.MathUtils.smoothstep(distance, fog.far * FADE_FROM, fog.far)) * (1 - FOG_DIMMING * fogged) * STRENGTH * this.spots[i + 4] / MAX_LEVEL;
            const colour = this.spots[i + 3];

            spot.addScaledVector(toCamera, Math.max(0, this.zone.raycast(spot, toCamera, Math.min(radius, distance), this.isWallOrPane) - GAP));
            centres.setXYZ(count, spot.x, spot.y, spot.z);
            colours.setXYZ(count, Math.floor(colour / 65536) / 255 * strength, Math.floor(colour / 256) % 256 / 255 * strength, colour % 256 / 255 * strength);
            sizes.setXY(count, radius, fogged);
            count++;
        }

        this.nextCheck = lights > 0 ? (this.nextCheck + checks) % lights : 0;
        this.geometry.instanceCount = count;
        centres.needsUpdate = true;
        colours.needsUpdate = true;
        sizes.needsUpdate = true;
    }

    // The share of a point's colour that the fog replaces. Must match
    // FOG_FRAGMENT in materials.js.
    fogBetween(camera, point, fog, { base, falloff, density })
    {
        const depth = -this.scratch.inView.copy(point).applyMatrix4(camera.matrixWorldInverse).z;
        const byDistance = THREE.MathUtils.smoothstep(depth, fog.near, fog.far);
        const from = Math.max(camera.position.y - base, 0) / falloff;
        const to = Math.max(point.y - base, 0) / falloff;
        const rise = to - from;
        const share = Math.abs(rise) > 0.001 ? (Math.exp(-from) - Math.exp(-to)) / rise : Math.exp(-from);
        const byHeight = 1 - Math.exp(-density * camera.position.distanceTo(point) * share);

        return 1 - (1 - byDistance) * (1 - byHeight);
    }

    dispose()
    {
        this.geometry.dispose();
        this.mesh.material.dispose();
    }
}
