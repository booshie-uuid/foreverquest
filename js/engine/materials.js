import * as THREE from "three";

const VERTEX_PARS = `
attribute float layer;
varying float vLayer;
varying vec2 vTileUv;
`;

const VERTEX = `
vLayer = layer;
vTileUv = uv;
`;

const FRAGMENT_PARS = `
uniform highp sampler2DArray worldAtlas;
varying float vLayer;
varying vec2 vTileUv;
`;

const TILE_FRAGMENT = `
vec4 tileTexel = texture(worldAtlas, vec3(vTileUv, floor(vLayer + 0.5)));
`;

const FRAGMENT = `
diffuseColor *= tileTexel;
`;

const STEPPED_VERTEX_PARS = `
attribute vec2 light;
attribute vec2 weather;
varying vec2 vLight;
varying vec2 vWeather;
varying vec3 vStepPosition;
varying vec3 vStepNormal;
`;

const STEPPED_VERTEX = `
vLight = light;
vWeather = weather;

#ifdef USE_INSTANCING
    vStepPosition = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
    vStepNormal = mat3(instanceMatrix) * objectNormal;
#else
    vStepPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
    vStepNormal = objectNormal;
#endif
`;

const STEPPED_FRAGMENT_PARS = `
uniform vec3 skyRamp[16];
uniform vec3 lampRamp[16];
uniform vec3 ambientFloor;
uniform vec4 playerLight;
uniform float cubeGrid;
varying vec2 vLight;
varying vec2 vWeather;
varying vec3 vStepPosition;
varying vec3 vStepNormal;
`;

// Each of vWeather's two overlays is layer * 4 + level, or 0 for none. An
// overlay texel shows at a level of at least its alpha * 3. Moss replaces the
// texel; grime and cracks darken it.
const WEATHER_FRAGMENT = `
for(int overlay = 0; overlay < 2; overlay++)
{
    float code = floor((overlay == 0 ? vWeather.x : vWeather.y) + 0.5);

    if(code < 1.0) { continue; }

    float overlayLayer = floor(code / 4.0);
    vec4 overlayTexel = texture(worldAtlas, vec3(vTileUv, overlayLayer));

    if(overlayTexel.a <= 0.0 || overlayTexel.a * 3.0 > code - overlayLayer * 4.0 + 0.01) { continue; }

    tileTexel.rgb = overlay == 0 ? overlayTexel.rgb : tileTexel.rgb * overlayTexel.rgb * 2.2;
}
`;

// 1 where the moon (or the sun) reaches a fragment, 0 where the fragment faces
// away from it or lies in its shadow. Three.js names the light's shadow map
// and coordinates; the first directional light is the moon.
const MOON = `
float moonLit = 1.0;

#if NUM_DIR_LIGHTS > 0
    moonLit = dot(geometryNormal, directionalLights[0].direction) > 0.0 ? 1.0 : 0.0;

    #if defined(USE_SHADOWMAP) && NUM_DIR_LIGHT_SHADOWS > 0
        moonLit *= getShadow(directionalShadowMap[0], directionalLightShadows[0].shadowMapSize, directionalLightShadows[0].shadowIntensity, directionalLightShadows[0].shadowBias, directionalLightShadows[0].shadowRadius, vDirectionalShadowCoord[0]);
    #endif
#endif

float skyShade = mix(0.55, 1.0, moonLit);
`;

// A face takes the sum of its sky and lamp colours from the zone's ramps, in
// place of the scene's lights, with the sky dimmed where the moon does not
// reach. The player's own light falls off a level a cell from the cell the
// player stands in.
// The zone's base level raises a face darker than it to its brightness, in
// the base's own colour. Light brighter than full scales down whole. Raising
// or capping each colour channel on its own would make colours that neither
// light has, such as a red light turning yellow beside its source.
const AMBIENT = `
vec3 fitLight(vec3 light)
{
    return light / max(1.0, max(light.r, max(light.g, light.b)));
}

vec3 floorLight(vec3 light, vec3 base)
{
    vec3 weights = vec3(0.2126, 0.7152, 0.0722);
    float baseBrightness = dot(base, weights);

    if(baseBrightness <= 0.0) { return light; }

    return light + base * max(0.0, 1.0 - dot(light, weights) / baseBrightness);
}
`;

const STEPPED_FRAGMENT = MOON + `
vec3 stepCell = floor((vStepPosition + vStepNormal * 0.05) * 3.0);
float nearPlayer = playerLight.w - floor(distance(stepCell, floor(playerLight.xyz * 3.0)));
int skyLevel = int(vLight.x * 15.0 + 0.5);
int lampLevel = clamp(int(max(vLight.y * 15.0 + 0.5, nearPlayer)), 0, 15);
vec3 stepLight = floorLight(fitLight(skyRamp[skyLevel] * skyShade + lampRamp[lampLevel]), ambientFloor);
float stepFace = vStepNormal.y > 0.5 ? 1.0 : (vStepNormal.y < -0.5 ? 0.55 : (abs(vStepNormal.x) > 0.5 ? 0.72 : 0.86));

outgoingLight = diffuseColor.rgb * stepLight * stepFace + totalEmissiveRadiance;

if(cubeGrid > 0.5)
{
    vec3 cubeLines = abs(fract(vStepPosition * 3.0 + 0.5) - 0.5) / max(fwidth(vStepPosition * 3.0), vec3(1e-4));
    vec3 metreLines = abs(fract(vStepPosition + 0.5) - 0.5) / max(fwidth(vStepPosition), vec3(1e-4));
    vec3 away = abs(vStepNormal) * 1e4;
    float cubeEdge = 1.0 - clamp(min(min(cubeLines.x + away.x, cubeLines.y + away.y), cubeLines.z + away.z), 0.0, 1.0);
    float metreEdge = 1.0 - clamp(min(min(metreLines.x + away.x, metreLines.y + away.y), metreLines.z + away.z) - 0.5, 0.0, 1.0);

    outgoingLight = mix(outgoingLight, vec3(1.0), cubeEdge * 0.3);
    outgoingLight = mix(outgoingLight, vec3(1.0, 0.78, 0.3), metreEdge * 0.85);
}
`;

const CHARACTER_FRAGMENT_PARS = `
uniform vec3 cellSky;
uniform vec3 cellLamp;
uniform vec3 ambientFloor;
` + AMBIENT;

const CHARACTER_FRAGMENT = MOON + `
vec3 worldNormal = inverseTransformDirection(geometryNormal, viewMatrix);
float faceShade = worldNormal.y >= 0.0 ? mix(0.8, 1.0, worldNormal.y) : mix(0.8, 0.55, -worldNormal.y);

outgoingLight = diffuseColor.rgb * floorLight(fitLight(cellSky * skyShade + cellLamp), ambientFloor) * faceShade + totalEmissiveRadiance;
`;

const FOG_VERTEX_PARS = `
#ifdef USE_FOG
    varying vec3 vFogWorld;
#endif
`;

const FOG_VERTEX = `
#ifdef USE_FOG
    #ifdef USE_INSTANCING
        vFogWorld = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
    #else
        vFogWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
    #endif
#endif
`;

const FOG_FRAGMENT_PARS = `
#ifdef USE_FOG
    uniform vec4 heightFog;
    varying vec3 vFogWorld;
#endif
`;

// Height fog has a density of heightFog.z per metre at heightFog.x and below,
// thinning by e every heightFog.y metres above it. The fog along the ray from
// the camera is the integral of that density, from Inigo Quilez's "better
// fog" (iquilezles.org/articles/fog), and it adds to the distance fog.
const FOG_FRAGMENT = `
#ifdef USE_FOG
    float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
    float fogFrom = max(cameraPosition.y - heightFog.x, 0.0) / heightFog.y;
    float fogTo = max(vFogWorld.y - heightFog.x, 0.0) / heightFog.y;
    float fogRise = fogTo - fogFrom;
    float fogShare = abs(fogRise) > 0.001 ? (exp(-fogFrom) - exp(-fogTo)) / fogRise : exp(-fogFrom);
    float fogHeight = 1.0 - exp(-heightFog.z * distance(vFogWorld, cameraPosition) * fogShare);

    fogFactor = 1.0 - (1.0 - fogFactor) * (1.0 - fogHeight);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
#endif
`;

const NO_HEIGHT_FOG = { base: 0, falloff: 1, density: 0 };
const LEVELS = 16;
const PLAYER_LIGHT = 7;
const DEFAULT_AMBIENT = { base: "#1c2030", level: 0.18 };
const DEFAULT_STEPS =
{
    sky: { dark: "#12141f", bright: "#56607e", curve: 1.4 },
    lamp: { dark: "#000000", bright: "#ffb466", curve: 0.6 },
};

export class MaterialLibrary
{
    constructor(atlas)
    {
        this.atlas = atlas;
        this.atlasTexture = atlas.createTexture();
        this.world = this.worldMaterial();
        this.fog = { heightFog: { value: new THREE.Vector4(NO_HEIGHT_FOG.base, NO_HEIGHT_FOG.falloff, NO_HEIGHT_FOG.density, 0) } };
        this.stepped = { skyRamp: { value: MaterialLibrary.ramp(DEFAULT_STEPS.sky) }, lampRamp: { value: MaterialLibrary.ramp(DEFAULT_STEPS.lamp) }, ambientFloor: { value: MaterialLibrary.floorOf(DEFAULT_AMBIENT) }, playerLight: { value: new THREE.Vector4(0, 0, 0, PLAYER_LIGHT) }, cubeGrid: { value: 0 } };
        this.terrain = this.worldMaterial({ vertexColors: true }, this.stepped);
        this.objects = this.worldMaterial({}, this.stepped);
        this.water = new THREE.MeshPhongMaterial({ color: "#1e2a30", specular: 0x5a6a78, shininess: 80, transparent: true, opacity: 0.82 });
        this.water.onBeforeCompile = (shader) => this.addHeightFog(shader);
    }

    addHeightFog(shader)
    {
        Object.assign(shader.uniforms, this.fog);

        shader.vertexShader = shader.vertexShader
            .replace("#include <fog_pars_vertex>", "#include <fog_pars_vertex>\n" + FOG_VERTEX_PARS)
            .replace("#include <fog_vertex>", "#include <fog_vertex>\n" + FOG_VERTEX);

        shader.fragmentShader = shader.fragmentShader
            .replace("#include <fog_pars_fragment>", "#include <fog_pars_fragment>\n" + FOG_FRAGMENT_PARS)
            .replace("#include <fog_fragment>", FOG_FRAGMENT);
    }

    setHeightFog({ base, falloff, density } = NO_HEIGHT_FOG)
    {
        this.fog.heightFog.value.set(base, falloff, density, 0);
    }

    // `stepped` adds the uniforms and code of stepped light.
    worldMaterial(options = {}, stepped = null)
    {
        const material = new THREE.MeshLambertMaterial(options);
        const uniforms = { worldAtlas: { value: this.atlasTexture }, ...stepped };
        const emissive = MaterialLibrary.emissiveShader(this.atlas.glowLayers);

        material.onBeforeCompile = (shader) =>
        {
            Object.assign(shader.uniforms, uniforms);

            shader.vertexShader = shader.vertexShader
                .replace("#include <common>", "#include <common>\n" + VERTEX_PARS + (stepped ? STEPPED_VERTEX_PARS : ""))
                .replace("#include <begin_vertex>", "#include <begin_vertex>\n" + VERTEX + (stepped ? STEPPED_VERTEX : ""));

            shader.fragmentShader = shader.fragmentShader
                .replace("#include <common>", "#include <common>\n" + FRAGMENT_PARS + (stepped ? STEPPED_FRAGMENT_PARS + AMBIENT : ""))
                .replace("#include <color_fragment>", "#include <color_fragment>\n" + TILE_FRAGMENT + (stepped ? WEATHER_FRAGMENT : "") + FRAGMENT)
                .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n" + emissive)
                .replace("#include <opaque_fragment>", (stepped ? STEPPED_FRAGMENT : "") + "#include <opaque_fragment>");

            this.addHeightFog(shader);
        };

        material.customProgramCacheKey = () => "world-atlas:" + this.atlas.glowLayers.join(",") + (material.vertexColors ? ":shaded" : "") + (stepped ? ":stepped" : "");

        return material;
    }

    // `steps` gives each of sky and lamp its darkest and brightest colours
    // and the curve between them; a zone without steps takes the defaults.
    setSteps(steps = DEFAULT_STEPS)
    {
        this.stepped.skyRamp.value = MaterialLibrary.ramp(steps.sky);
        this.stepped.lampRamp.value = MaterialLibrary.ramp(steps.lamp);
    }

    // `ambient` gives the zone's base colour and its brightness, from 0 to 1;
    // a zone without one takes the default.
    setAmbient(ambient = DEFAULT_AMBIENT)
    {
        this.stepped.ambientFloor.value.copy(MaterialLibrary.floorOf(ambient));
    }

    // The base colour at full strength, scaled to the level, in sRGB as the
    // ramps are, then converted for the shader.
    static floorOf({ base, level })
    {
        const colour = new THREE.Color(base).getRGB({}, THREE.SRGBColorSpace);
        const strongest = Math.max(colour.r, colour.g, colour.b, 1e-6);

        return new THREE.Color().setRGB(colour.r / strongest * level, colour.g / strongest * level, colour.b / strongest * level, THREE.SRGBColorSpace);
    }

    colours(sky, lamp)
    {
        return { sky: this.stepped.skyRamp.value[sky], lamp: this.stepped.lampRamp.value[lamp] };
    }

    // Lights a character's material as stepped light lights the terrain, by
    // the `cellSky` and `cellLamp` colours in `cell`.
    shadeCharacter(material, cell)
    {
        material.onBeforeCompile = (shader) =>
        {
            Object.assign(shader.uniforms, cell, { ambientFloor: this.stepped.ambientFloor });

            shader.fragmentShader = shader.fragmentShader
                .replace("#include <common>", "#include <common>\n" + CHARACTER_FRAGMENT_PARS)
                .replace("#include <opaque_fragment>", CHARACTER_FRAGMENT + "#include <opaque_fragment>");

            this.addHeightFog(shader);
        };

        material.customProgramCacheKey = () => "character-stepped";
    }

    setGrid(isOn)
    {
        this.stepped.cubeGrid.value = isOn ? 1 : 0;
    }

    setPlayerLight(position)
    {
        this.stepped.playerLight.value.set(position.x, position.y + 1, position.z, PLAYER_LIGHT);
    }

    // The colours are mixed as written, in sRGB, then converted for the shader.
    static ramp({ dark, bright, curve })
    {
        const from = new THREE.Color(dark).getRGB({}, THREE.SRGBColorSpace);
        const to = new THREE.Color(bright).getRGB({}, THREE.SRGBColorSpace);

        return Array.from({ length: LEVELS }, (unused, level) =>
        {
            const t = (level / (LEVELS - 1)) ** curve;

            return new THREE.Color().setRGB(from.r + (to.r - from.r) * t, from.g + (to.g - from.g) * t, from.b + (to.b - from.b) * t, THREE.SRGBColorSpace);
        });
    }

    static emissiveShader(glowLayers)
    {
        if(glowLayers.length === 0) { return ""; }

        const isGlow = glowLayers.map((layer) => "abs(vLayer - " + layer + ".0) < 0.5").join(" || ");

        return "if(" + isGlow + ") { totalEmissiveRadiance += tileTexel.rgb * 1.6; }\n";
    }
}
