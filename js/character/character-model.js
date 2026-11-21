import * as Kit from "./kit.js";
import * as Outfit from "./outfit.js";
import * as THREE from "three";
import { BlockBuilder } from "../geometry/block-builder.js";
import { Random } from "../util/random.js";
import { Sheet } from "./sheet.js";

const JOINTS = ["torso", "legL", "legR", "head", "armL", "armR", "cape"];

export class CharacterModel
{
    constructor(appearance)
    {
        this.appearance = appearance;
        this.root = new THREE.Group();
        this.body = new THREE.Group();
        this.joints = { root: this.body };
        this.meshes = [];
        this.material = null;
        this.textures = null;
        this.plan = null;
        this.listeners = [];

        this.root.add(this.body);
        this.root.userData.model = this;
        this.createJoints();
        this.unsubscribe = appearance.onChange(() => this.rebuild());
        this.rebuild();
    }

    createJoints()
    {
        for(const name of JOINTS)
        {
            const joint = new THREE.Group();

            joint.name = name;
            this.joints[name] = joint;
        }
    }

    /* BUILD ******************************************************************/

    rebuild()
    {
        const look = this.appearance;
        const dims = Kit.dimensions(look);
        const blocks = [...Kit.bodyBlocks(dims), ...Kit.partBlocks(look, dims)];
        const sheet = new Sheet();

        for(const block of blocks) { block.areas = sheet.reserve(block.size); }

        sheet.open();
        this.paint(sheet, blocks, Outfit.layers(look, dims));

        const builders = new Map();

        for(const block of blocks)
        {
            if(!builders.has(block.joint)) { builders.set(block.joint, new BlockBuilder()); }

            const size = block.size.map((value) => value * Kit.TEXEL);
            const at = block.at.map((value) => value * Kit.TEXEL);

            builders.get(block.joint).add(size, at, block.rotation, (face) => ({ uv: sheet.uv(block.areas[face]) }));
        }

        this.clear();
        this.textures = sheet.toTextures();
        this.material = new THREE.MeshLambertMaterial({ map: this.textures.map, emissiveMap: this.textures.glow, emissive: 0xffffff, emissiveIntensity: 1.4, alphaTest: 0.5 });
        this.layoutJoints(dims);

        for(const [joint, builder] of builders)
        {
            const mesh = new THREE.Mesh(builder.build(), this.material);

            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.joints[joint].add(mesh);
            this.meshes.push(mesh);
        }

        this.plan =
        {
            dims,
            height: Kit.height(dims),
            headHeight: dims.head[1] * Kit.TEXEL * dims.scale,
            width: dims.torso[0] * Kit.TEXEL * dims.scale,
        };

        this.emitChange();
    }

    paint(sheet, blocks, layers)
    {
        const random = Random.fromString(this.appearance.get("name") + this.appearance.get("race"));

        for(const block of blocks)
        {
            for(const face of BlockBuilder.FACES)
            {
                const painters = block.part ? layers[block.part][face.name] : [block.faces[face.name] ?? block.faces.all];

                for(const painter of painters) { painter(sheet.raster, block.areas[face.name], random, sheet.glow); }
            }
        }
    }

    layoutJoints(dims)
    {
        for(const [name, joint] of Object.entries(Kit.joints(dims)))
        {
            const node = this.joints[name];

            this.joints[joint.parent].add(node);
            node.position.set(joint.at[0] * Kit.TEXEL, joint.at[1] * Kit.TEXEL, joint.at[2] * Kit.TEXEL);
        }

        this.body.scale.setScalar(dims.scale);
    }

    clear()
    {
        for(const mesh of this.meshes)
        {
            mesh.removeFromParent();
            mesh.geometry.dispose();
        }

        this.meshes = [];
        this.material?.dispose();
        this.textures?.map.dispose();
        this.textures?.glow.dispose();
    }

    get triangleCount()
    {
        return this.meshes.reduce((total, mesh) => total + mesh.geometry.getAttribute("position").count / 3, 0);
    }

    /* EVENTS *****************************************************************/

    onChange(listener)
    {
        this.listeners.push(listener);
    }

    emitChange()
    {
        for(const listener of this.listeners) { listener(this); }
    }

    dispose()
    {
        this.unsubscribe();
        this.clear();
        this.root.removeFromParent();
    }
}
