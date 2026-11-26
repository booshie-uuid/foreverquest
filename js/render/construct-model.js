import * as FineGeometry from "./fine-geometry.js";
import * as FineMesher from "./fine-mesher.js";
import * as Fitter from "../kit/fitter.js";
import * as THREE from "three";

const FINE_PER_METRE = FineMesher.FINE * 3;


/******************************************************************************/
/* CONSTRUCT MODEL                                                            */
/******************************************************************************/

// Has the `plan` and `joints` a ClipPlayer moves, as a CharacterModel has.
// `look` is a ConstructLook; `materials` gives the material, lit by the
// uniforms in `cell`.
export class ConstructModel
{
    constructor(look, materials, blocks, cell)
    {
        const construct = look.construct;
        const rig = look.library.rig(construct.rig);
        const fitted = Fitter.fit(rig, construct.body, {});

        this.appearance = look;
        this.construct = construct;
        this.root = new THREE.Group();
        this.body = new THREE.Group();
        this.joints = { root: this.body };
        this.meshes = [];
        this.material = materials.constructMaterial(cell);

        fitted.scale = construct.scale;
        this.root.add(this.body);
        this.root.userData.model = this;
        this.createJoints(fitted);
        this.hangPieces(fitted, materials.atlas, blocks);
        this.plan = planOf(fitted);
        this.pose(1);
    }

    get triangleCount()
    {
        return this.meshes.reduce((sum, mesh) => sum + mesh.geometry.index.count / 3, 0);
    }

    createJoints(fitted)
    {
        for(const bone of fitted.bones)
        {
            const joint = new THREE.Group();

            joint.name = bone.name;
            joint.position.set(...bone.pivot.map((value) => value * Fitter.TEXEL));
            this.joints[bone.name] = joint;
        }

        for(const bone of fitted.bones) { this.joints[bone.parent].add(this.joints[bone.name]); }

        this.body.scale.setScalar(fitted.scale);
    }

    hangPieces(fitted, atlas, blocks)
    {
        const hang = (bone, piece, middle) =>
        {
            const mesh = new THREE.Mesh(FineGeometry.build(FineMesher.decode(piece), atlas, blocks), this.material);

            mesh.position.set(...middle.map((value, axis) => value * Fitter.TEXEL - piece.size[axis] / FINE_PER_METRE / 2));
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.joints[bone].add(mesh);
            this.meshes.push(mesh);
        };

        for(const bone of fitted.bones.filter((entry) => entry.size)) { hang(bone.name, this.construct.pieces[bone.name], bone.centre); }
        for(const extra of this.construct.extras) { hang(extra.bone, extra.piece, extra.at); }
    }

    // Turns each joint to its rest angles plus `asleep` of the way to its
    // dormant pose: 1 asleep, 0 awake.
    pose(asleep)
    {
        for(const bone of this.plan.fit.bones) { this.joints[bone.name].rotation.set(...bone.rest); }

        this.addDormant(asleep);
    }

    // Adds `asleep` of the dormant pose to the joints as they stand.
    addDormant(asleep)
    {
        for(const [bone, angles] of Object.entries(this.construct.dormant))
        {
            const joint = this.joints[bone];

            joint.rotation.set(joint.rotation.x + angles[0] * asleep, joint.rotation.y + angles[1] * asleep, joint.rotation.z + angles[2] * asleep);
        }
    }

    dispose()
    {
        for(const mesh of this.meshes) { mesh.geometry.dispose(); }

        this.meshes = [];
        this.material.dispose();
        this.root.removeFromParent();
    }
}

function planOf(fitted)
{
    return {
        fit: fitted,
        rig: fitted.rig,
        boxes: fitted.boxes,
        scale: fitted.scale,
        rest: Object.fromEntries(fitted.bones.map((bone) => [bone.name, new THREE.Vector3(...bone.pivot.map((value) => value * Fitter.TEXEL))])),
        height: fitted.top * Fitter.TEXEL * fitted.scale,
    };
}
