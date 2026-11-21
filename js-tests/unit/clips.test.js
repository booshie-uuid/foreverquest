import * as ClipModule from "../../js/kit/clip-player.js";
import * as Motion from "../reference/motion.js";
import * as TestAssets from "../helpers/assets.js";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, it } from "node:test";
import { Appearance } from "../../js/character/appearance.js";
import { CharacterModel } from "../../js/character/character-model.js";
import { ClipPlayer } from "../../js/kit/clip-player.js";

const library = await TestAssets.library();
const REFERENCE = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "..", "reference", "prototype-motion.json"), "utf8"));

// The prototype swayed the cape with the breath while walking, by up to 0.02
// radians; the clips leave that out.
const ANGLE_TOLERANCE = 0.025;
const LIFT_TOLERANCE = 0.003;

describe("Clip player", () =>
{
    it("moves every joint as the prototype's animator did, within a small tolerance", () =>
    {
        for(const entry of Motion.CASES)
        {
            const expected = REFERENCE.find((recorded) => recorded.label === entry.label).samples;
            const actual = Motion.sample(library, entry, (model) => new ClipPlayer(model));

            expected.forEach((reference, i) =>
            {
                const label = entry.label + " at " + reference.time + " s";

                for(const [bone, angles] of Object.entries(reference.joints))
                {
                    angles.forEach((angle, axis) =>
                    {
                        const difference = Math.abs(actual[i].joints[bone][axis] - angle);

                        assert.ok(difference < ANGLE_TOLERANCE, label + ": " + bone + " axis " + axis + " is " + actual[i].joints[bone][axis] + ", not " + angle);
                    });
                }

                assert.ok(Math.abs(actual[i].lift - reference.lift) < LIFT_TOLERANCE, label + ": the torso lifts " + actual[i].lift + ", not " + reference.lift);
            });
        }
    });

    it("passes through its keys and loops", () =>
    {
        const keys = [0, 1, 0, -1];

        assert.equal(ClipModule.sample(keys, 0.25), 1);
        assert.equal(ClipModule.sample(keys, 1.75), -1);
        assert.equal(ClipModule.sample([0.3], 0.6), 0.3);
        assert.ok(Math.abs(ClipModule.sample(keys, 0.125) - 0.625) < 1e-9);
    });

    it("ends an action after its seconds, and reports it while it plays", () =>
    {
        const player = new ClipPlayer(new CharacterModel(new Appearance(library)));

        player.wave();
        player.update(1, 0);

        assert.equal(player.isWaving, true);

        player.update(1.3, 0);

        assert.equal(player.isWaving, false);
    });

    it("walks a creature on its own rig's clips", () =>
    {
        const model = new CharacterModel(new Appearance(library, { body: "wolf" }));
        const player = new ClipPlayer(model);

        let widest = 0;

        for(let i = 0; i < 30; i++)
        {
            player.update(0.05, player.speeds.walk);
            widest = Math.max(widest, Math.abs(model.joints.legFL.rotation.x));
        }

        assert.ok(widest > 0.2, "The legs swung only " + widest);
        assert.ok(Math.abs(model.joints.legFL.rotation.x + model.joints.legFR.rotation.x) < 1e-9, "The left and right front legs should swing in opposite phase");
        assert.ok(Math.abs(model.joints.tail.rotation.x + 0.55) < 1e-9, "The tail left its rest angle about x");
    });
});
