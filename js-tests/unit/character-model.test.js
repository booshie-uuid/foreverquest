import * as TestAssets from "../helpers/assets.js";
import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Animator } from "../../js/character/animator.js";
import { Appearance } from "../../js/character/appearance.js";
import { CharacterModel } from "../../js/character/character-model.js";

const library = await TestAssets.library();

const TRIANGLE_BUDGET = 1200;
const SHEET_LIMIT = 512;

function assertSound(model, label)
{
    assert.ok(model.meshes.length >= 6, label + ": " + model.meshes.length + " meshes");
    assert.ok(model.triangleCount < TRIANGLE_BUDGET, label + ": " + model.triangleCount + " triangles");
    assert.ok(model.textures.map.image.height <= SHEET_LIMIT, label + ": sheet is " + model.textures.map.image.height + " rows");

    for(const mesh of model.meshes)
    {
        const positions = mesh.geometry.getAttribute("position").array;
        const uvs = mesh.geometry.getAttribute("uv").array;

        assert.ok(positions.every(Number.isFinite), label + ": a vertex of " + mesh.parent.name + " is not finite");
        assert.ok(uvs.every((value) => value >= 0 && value <= 1), label + ": a UV of " + mesh.parent.name + " leaves the sheet");
    }
}

function headTriangles(model)
{
    return model.meshes.filter((mesh) => mesh.parent.name === "head").reduce((total, mesh) => total + mesh.geometry.getAttribute("position").count / 3, 0);
}

describe("CharacterModel", () =>
{
    it("builds every playable body and variant with every face, nose, hair, beard and marking", () =>
    {
        const fields = Object.fromEntries(["face", "nose", "hair", "beard", "markings"].map((field) => [field, library.partsFor(field)]));

        for(const body of library.playableBodies)
        {
            for(const variant of body.variants)
            {
                const look = new Appearance(library, { body: body.id, variant: variant.id });
                const model = new CharacterModel(look);

                for(const [field, options] of Object.entries(fields))
                {
                    for(const option of options)
                    {
                        look.set(field, option.id);
                        assertSound(model, body.id + " " + variant.id + " " + field + "=" + option.id);
                    }
                }

                model.dispose();
            }
        }
    });

    it("builds every equipment item for every playable body", () =>
    {
        for(const body of library.playableBodies)
        {
            const look = new Appearance(library, { body: body.id });
            const model = new CharacterModel(look);

            for(const slot of library.rig("humanoid").gear)
            {
                for(const item of library.partsFor(slot.id))
                {
                    look.equip(slot.id, item.id);
                    assertSound(model, body.id + " " + slot.id + "=" + item.id);
                }

                look.equip(slot.id, "none");
            }

            model.dispose();
        }
    });

    it("rebuilds on a change and disposes the old geometry, material and sheet", () =>
    {
        const look = new Appearance(library, { hair: "crop" });
        const model = new CharacterModel(look);
        const old = [...model.meshes.map((mesh) => mesh.geometry), model.material, model.textures.map];
        const disposed = new Set();

        for(const resource of old) { resource.addEventListener("dispose", () => disposed.add(resource)); }

        look.set("hair", "long");

        assert.equal(disposed.size, old.length);
        assert.ok(model.meshes.every((mesh) => !old.includes(mesh.geometry)));
    });

    it("leaves out hair blocks under a closed helm", () =>
    {
        const look = new Appearance(library, { hair: "bald", equipment: { head: { item: "helm" } } });
        const model = new CharacterModel(look);
        const bald = headTriangles(model);

        look.set("hair", "long");

        assert.equal(headTriangles(model), bald);

        look.equip("head", "none");

        assert.ok(headTriangles(model) > bald - 12);
    });

    it("stands every body, creatures included, on the ground at rest", () =>
    {
        for(const body of library.allBodies)
        {
            const model = new CharacterModel(new Appearance(library, { body: body.id, equipment: { mainHand: { item: "none" }, offHand: { item: "none" }, back: { item: "none" } } }));
            let lowest = Infinity;

            new Animator(model).update(0.016, 0);
            model.root.updateMatrixWorld(true);

            for(const mesh of model.meshes)
            {
                mesh.geometry.computeBoundingBox();
                lowest = Math.min(lowest, mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld).min.y);
            }

            assert.ok(Math.abs(lowest) < 0.01, body.id + ": the lowest point is at " + lowest.toFixed(3));
        }
    });

    it("moves the limbs only by turning them at their joints", () =>
    {
        const model = new CharacterModel(new Appearance(library));
        const animator = new Animator(model);
        const rest = Object.fromEntries(["legL", "armL", "head"].map((name) => [name, model.joints[name].position.clone()]));

        for(let i = 0; i < 40; i++) { animator.update(0.05, Animator.RUN_SPEED); }

        assert.ok(Math.abs(model.joints.legL.rotation.x) > 0.1, "The legs did not swing");

        for(const [name, position] of Object.entries(rest)) { assert.ok(model.joints[name].position.distanceTo(position) < 1e-9, name + " moved"); }
    });
});
