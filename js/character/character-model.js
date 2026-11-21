import * as Dresser from "../kit/dresser.js";
import * as Fitter from "../kit/fitter.js";
import * as Kit from "./kit.js";
import * as Outfit from "./outfit.js";
import * as Placeholder from "./placeholder.js";
import * as THREE from "three";
import { BlockBuilder } from "../geometry/block-builder.js";
import { Random } from "../util/random.js";
import { Sheet } from "./sheet.js";

export class CharacterModel
{
    constructor(appearance, { pipeline = "legacy" } = {})
    {
        this.appearance = appearance;
        this.pipeline = pipeline;
        this.root = new THREE.Group();
        this.body = new THREE.Group();
        this.joints = { root: this.body };
        this.rigId = null;
        this.meshes = [];
        this.material = null;
        this.textures = null;
        this.plan = null;
        this.listeners = [];

        this.root.add(this.body);
        this.root.userData.model = this;
        this.unsubscribe = appearance.onChange(() => this.rebuild());
        this.rebuild();
    }

    /* BUILD ******************************************************************/

    rebuild()
    {
        const look = this.appearance;
        const body = look.body;
        const rig = look.library.rig(body.rig);
        const fitted = Fitter.fit(rig, body, { variant: look.get("variant"), height: look.get("height"), build: look.get("build") });
        const { blocks, layers } = this.assemble(look, fitted);
        const sheet = new Sheet();

        for(const block of blocks) { block.areas = sheet.reserve(block.size); }

        sheet.open();
        this.paint(sheet, blocks, layers);

        const builders = new Map();

        for(const block of blocks)
        {
            if(!builders.has(block.joint)) { builders.set(block.joint, new BlockBuilder()); }

            const size = block.size.map((value) => value * Fitter.TEXEL);
            const at = block.at.map((value) => value * Fitter.TEXEL);

            builders.get(block.joint).add(size, at, block.rotation, (face) => ({ uv: sheet.uv(block.areas[face]) }));
        }

        this.clear();
        this.textures = sheet.toTextures();
        this.material = new THREE.MeshLambertMaterial({ map: this.textures.map, emissiveMap: this.textures.glow, emissive: 0xffffff, emissiveIntensity: 1.4, alphaTest: 0.5 });
        this.layoutJoints(fitted);

        for(const [joint, builder] of builders)
        {
            const mesh = new THREE.Mesh(builder.build(), this.material);

            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.joints[joint].add(mesh);
            this.meshes.push(mesh);
        }

        this.plan = CharacterModel.planOf(fitted);
        this.emitChange();
    }

    assemble(look, fitted)
    {
        const body = [...Fitter.bodyBlocks(fitted)];
        const dims = { ...fitted.boxes, scale: fitted.scale };

        if(look.body.surface !== "outfit") { return { blocks: body, layers: Placeholder.layers(look, fitted) }; }
        if(this.pipeline === "legacy") { return { blocks: [...body, ...Kit.partBlocks(look, dims)], layers: Outfit.layers(look, dims) }; }

        const dressed = Dresser.dress(fitted, look, look.library);

        return { blocks: [...body, ...Kit.featureBlocks(look), ...dressed.blocks], layers: dressed.layers };
    }

    static planOf(fitted)
    {
        const metres = (texels) => texels * Fitter.TEXEL * fitted.scale;
        const face = fitted.bones.find((bone) => bone.name === fitted.rig.faceBone);
        const rest = Object.fromEntries(fitted.bones.map((bone) => [bone.name, new THREE.Vector3(...bone.pivot).multiplyScalar(Fitter.TEXEL)]));

        return {
            fit: fitted,
            rig: fitted.rig,
            boxes: fitted.boxes,
            scale: fitted.scale,
            rest,
            height: fitted.top * Fitter.TEXEL * fitted.scale,
            headHeight: metres(face.size[1]),
        };
    }

    paint(sheet, blocks, layers)
    {
        const random = Random.fromString(this.appearance.get("name") + this.appearance.get("body"));

        for(const block of blocks)
        {
            for(const face of BlockBuilder.FACES)
            {
                const painters = block.part ? layers[block.part][face.name] : [block.faces[face.name] ?? block.faces.all];

                for(const painter of painters) { painter(sheet.raster, block.areas[face.name], random, sheet.glow); }
            }
        }
    }

    layoutJoints(fitted)
    {
        if(this.rigId !== fitted.rig.id) { this.createJoints(fitted.rig); }

        for(const bone of fitted.bones)
        {
            const node = this.joints[bone.name];

            this.joints[bone.parent].add(node);
            node.position.set(...bone.pivot.map((value) => value * Fitter.TEXEL));
            node.rotation.set(...bone.rest);
        }

        this.body.scale.setScalar(fitted.scale);
    }

    createJoints(rig)
    {
        for(const [name, node] of Object.entries(this.joints))
        {
            if(name !== "root") { node.removeFromParent(); }
        }

        this.joints = { root: this.body };

        for(const bone of rig.bones)
        {
            const joint = new THREE.Group();

            joint.name = bone.name;
            this.joints[bone.name] = joint;
        }

        this.rigId = rig.id;
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
