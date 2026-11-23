import * as Fitter from "../../js/kit/fitter.js";
import * as TestAssets from "../helpers/assets.js";
import * as assert from "node:assert/strict";
import { describe, it } from "node:test";

const library = await TestAssets.library();

function fit(bodyId, choices = {})
{
    const body = library.body(bodyId);

    return Fitter.fit(library.rig(body.rig), body, { variant: "male", ...choices });
}

function bone(fitted, name)
{
    return fitted.bones.find((entry) => entry.name === name);
}

function metres(fitted)
{
    return fitted.top * Fitter.TEXEL * fitted.scale;
}

describe("Fitter boxes", () =>
{
    it("gives every playable body a 16-texel head", () =>
    {
        for(const body of library.playableBodies) { assert.deepEqual(fit(body.id).boxes.head, [16, 16, 16], body.id); }
    });

    it("makes a human 88 texels tall with a head about a fifth and a half of that", () =>
    {
        const human = fit("human");
        const ratio = metres(human) / (human.boxes.head[1] * Fitter.TEXEL);

        assert.ok(Math.abs(metres(human) - 88 / 48) < 1e-9);
        assert.ok(ratio > 5.2 && ratio < 5.8, "The head is 1/" + ratio.toFixed(2));
    });

    it("keeps the legs at half the torso's width and its full depth for every variant and build", () =>
    {
        for(const body of library.playableBodies)
        {
            for(const variant of body.variants)
            {
                for(const build of [-1, -0.3, 0, 0.6, 1])
                {
                    const { torso, leg } = fit(body.id, { variant: variant.id, build }).boxes;

                    assert.equal(leg[0] * 2, torso[0], body.id + " " + variant.id + " " + build);
                    assert.equal(leg[2], torso[2], body.id + " " + variant.id + " " + build);
                }
            }
        }
    });

    it("makes dwarves shorter and broader, and the female variant narrower", () =>
    {
        const human = fit("human");
        const dwarf = fit("dwarf");

        assert.ok(metres(dwarf) < metres(human));
        assert.ok(dwarf.boxes.torso[0] > human.boxes.torso[0]);
        assert.ok(fit("human", { variant: "female" }).boxes.torso[0] < human.boxes.torso[0]);
    });

    it("widens in whole steps with build and scales with height", () =>
    {
        assert.equal(fit("human", { build: 1 }).boxes.torso[0], 28);
        assert.equal(fit("human", { build: 0.2 }).boxes.torso[0], 24);
        assert.equal(fit("human", { build: -1 }).boxes.torso[0], 20);
        assert.ok(metres(fit("human", { height: 1 })) > metres(fit("human", { height: -1 })));
    });

    it("falls back to the first variant for a variant the body does not have", () =>
    {
        assert.deepEqual(fit("human", { variant: "dragon" }).boxes, fit("human").boxes);
    });
});

describe("Fitter bones", () =>
{
    it("hangs the arms outside the torso and the legs under it", () =>
    {
        const fitted = fit("human");
        const { torso, arm, leg } = fitted.boxes;

        assert.equal(bone(fitted, "armL").pivot[0], (torso[0] + arm[0]) / 2);
        assert.equal(bone(fitted, "armR").pivot[0], -bone(fitted, "armL").pivot[0]);
        assert.equal(bone(fitted, "legL").pivot[1], leg[1]);
        assert.equal(bone(fitted, "head").parent, "torso");
    });

    it("lists one body block for each bone with a box, in the rig's order", () =>
    {
        const blocks = Fitter.bodyBlocks(fit("human"));

        assert.deepEqual(blocks.map((block) => block.joint), ["head", "torso", "armL", "armR", "legL", "legR"]);
        assert.ok(blocks.every((block) => block.part === block.joint));
    });

    it("fits a creature on its own rig, with its feet on the ground", () =>
    {
        const wolf = fit("wolf");
        const leg = bone(wolf, "legFL");

        assert.equal(wolf.rig.id, "quadruped");
        assert.equal(leg.pivot[1] + leg.centre[1] - leg.size[1] / 2, 0);
        assert.equal(bone(wolf, "legFR").pivot[0], -leg.pivot[0]);
        assert.ok(metres(wolf) < 1, "The wolf is " + metres(wolf) + " metres tall");
    });

    it("evaluates a linear form of box sizes", () =>
    {
        const boxes = { torso: [24, 32, 12], arm: [8, 32, 8] };

        assert.equal(Fitter.evaluate({ c: -2, t: [[0.5, "torso", 0], [0.5, "arm", 0]] }, boxes), 14);
        assert.ok(Object.is(Fitter.evaluate({ c: -0, t: [] }, boxes), 0), "A mirrored zero stays positive");
    });
});
