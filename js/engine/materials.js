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

const FRAGMENT = `
vec4 tileTexel = texture(worldAtlas, vec3(vTileUv, floor(vLayer + 0.5)));
diffuseColor *= tileTexel;
`;

export class MaterialLibrary
{
    constructor(atlas)
    {
        this.atlas = atlas;
        this.atlasTexture = atlas.createTexture();
        this.world = this.worldMaterial();
        this.terrain = this.worldMaterial({ vertexColors: true });
        this.water = new THREE.MeshPhongMaterial({ color: "#1e2a30", specular: 0x5a6a78, shininess: 80, transparent: true, opacity: 0.82 });
    }

    worldMaterial(options = {})
    {
        const material = new THREE.MeshLambertMaterial(options);
        const uniforms = { worldAtlas: { value: this.atlasTexture } };
        const emissive = MaterialLibrary.emissiveShader(this.atlas.glowLayers);

        material.onBeforeCompile = (shader) =>
        {
            Object.assign(shader.uniforms, uniforms);

            shader.vertexShader = shader.vertexShader
                .replace("#include <common>", "#include <common>\n" + VERTEX_PARS)
                .replace("#include <begin_vertex>", "#include <begin_vertex>\n" + VERTEX);

            shader.fragmentShader = shader.fragmentShader
                .replace("#include <common>", "#include <common>\n" + FRAGMENT_PARS)
                .replace("#include <color_fragment>", "#include <color_fragment>\n" + FRAGMENT)
                .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n" + emissive);
        };

        material.customProgramCacheKey = () => "world-atlas:" + this.atlas.glowLayers.join(",") + (material.vertexColors ? ":shaded" : "");

        return material;
    }

    static emissiveShader(glowLayers)
    {
        if(glowLayers.length === 0) { return ""; }

        const isGlow = glowLayers.map((layer) => "abs(vLayer - " + layer + ".0) < 0.5").join(" || ");

        return "if(" + isGlow + ") { totalEmissiveRadiance += tileTexel.rgb * 1.6; }\n";
    }
}
