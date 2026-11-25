import * as THREE from "three";

const RADIUS = 0.53;
const FOG_GROWTH = 2.6;
const FADE_FROM = 0.85;
const GAP = 0.05;
const MAX_LEVEL = 15;
const FIRST_CAPACITY = 64;

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
        this.geometry = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(1, 1));
        this.geometry.instanceCount = 0;
        this.mesh = new THREE.Mesh(this.geometry, new THREE.ShaderMaterial({ vertexShader: VERTEX, fragmentShader: FRAGMENT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        this.mesh.name = "halos";
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = 1;
        this.scratch = { spot: new THREE.Vector3(), toCamera: new THREE.Vector3(), inView: new THREE.Vector3() };
        this.isStop = (x, y, z) =>
        {
            const block = zone.blockAt(x, y, z);

            return zone.blocks.isOpaque(block) && zone.blocks.light(block) === 0;
        };

        this.allocate(FIRST_CAPACITY);
    }

    // `spots` holds [x, y, z, colour, level] for each light, as the mesher
    // gives them.
    setSpots(spots)
    {
        this.spots = spots;

        if(spots.length / 5 > this.capacity) { this.allocate(spots.length / 5); }
    }

    allocate(count)
    {
        this.capacity = count;

        for(const [name, size] of [["centre", 3], ["colour", 3], ["size", 2]])
        {
            this.geometry.setAttribute(name, new THREE.InstancedBufferAttribute(new Float32Array(count * size), size).setUsage(THREE.DynamicDrawUsage));
        }
    }

    get count()
    {
        return this.geometry.instanceCount;
    }

    // `fog` is the scene's Fog and `heightFog` { base, falloff, density }.
    update(camera, fog, heightFog)
    {
        const centres = this.geometry.getAttribute("centre");
        const colours = this.geometry.getAttribute("colour");
        const sizes = this.geometry.getAttribute("size");
        const { spot, toCamera } = this.scratch;
        let count = 0;

        camera.updateMatrixWorld();

        for(let i = 0; i < this.spots.length; i += 5)
        {
            spot.set(this.spots[i], this.spots[i + 1], this.spots[i + 2]);

            const distance = spot.distanceTo(camera.position);

            if(distance >= fog.far) { continue; }

            const fogged = this.fogBetween(camera, spot, fog, heightFog);
            const radius = RADIUS + FOG_GROWTH * fogged;
            const strength = (1 - THREE.MathUtils.smoothstep(distance, fog.far * FADE_FROM, fog.far)) * this.spots[i + 4] / MAX_LEVEL;
            const colour = this.spots[i + 3];

            toCamera.subVectors(camera.position, spot).normalize();
            spot.addScaledVector(toCamera, Math.max(0, this.zone.raycast(spot, toCamera, Math.min(radius, distance), this.isStop) - GAP));
            centres.setXYZ(count, spot.x, spot.y, spot.z);
            colours.setXYZ(count, Math.floor(colour / 65536) / 255 * strength, Math.floor(colour / 256) % 256 / 255 * strength, colour % 256 / 255 * strength);
            sizes.setXY(count, radius, fogged);
            count++;
        }

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
