import * as THREE from "three";
import * as WorldTextures from "../world/world-textures.js";

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

const EMISSIVE = `
if(abs(vLayer - ${WorldTextures.index("glow")}.0) < 0.5) { totalEmissiveRadiance += tileTexel.rgb * 1.6; }
`;

export class MaterialLibrary
{
    constructor()
    {
        this.atlas = WorldTextures.createAtlas();
        this.world = this.worldMaterial();
        this.water = new THREE.MeshPhongMaterial({ color: "#1e2a30", specular: 0x5a6a78, shininess: 80, transparent: true, opacity: 0.82 });
    }

    worldMaterial()
    {
        const material = new THREE.MeshLambertMaterial();
        const uniforms = { worldAtlas: { value: this.atlas } };

        material.onBeforeCompile = (shader) =>
        {
            Object.assign(shader.uniforms, uniforms);

            shader.vertexShader = shader.vertexShader
                .replace("#include <common>", "#include <common>\n" + VERTEX_PARS)
                .replace("#include <begin_vertex>", "#include <begin_vertex>\n" + VERTEX);

            shader.fragmentShader = shader.fragmentShader
                .replace("#include <common>", "#include <common>\n" + FRAGMENT_PARS)
                .replace("#include <color_fragment>", "#include <color_fragment>\n" + FRAGMENT)
                .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n" + EMISSIVE);
        };

        material.customProgramCacheKey = () => "world-atlas";

        return material;
    }
}
