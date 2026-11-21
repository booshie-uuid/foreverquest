import * as TestAssets from "../helpers/assets.js";
import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Appearance } from "../../js/character/appearance.js";
import { CharacterStore } from "../../js/character-store.js";
import { Entity } from "../../js/sim/entity.js";

const library = await TestAssets.library();

const OPEN_FIELD =
{
    heightAt: () => 1,
    resolveStep: (from, to) => ({ x: to.x, z: to.z }),
    isWalkable: () => true,
};

const WALL =
{
    heightAt: () => 0,
    resolveStep: (from) => ({ x: from.x, z: from.z }),
    isWalkable: () => true,
};

function run(actor, world, seconds)
{
    for(let time = 0; time < seconds; time += 0.05) { actor.tick(0.05, world); }
}

describe("Entity", () =>
{
    it("walks to a target, stands on the ground and faces the way it went", () =>
    {
        const actor = new Entity(1, new Appearance(library));

        actor.placeAt(0, 0, OPEN_FIELD);
        actor.moveTo({ x: 4, z: 0 });
        run(actor, OPEN_FIELD, 3);

        assert.ok(Math.abs(actor.position.x - 4) < 0.2, "x is " + actor.position.x);
        assert.equal(actor.position.y, 1);
        assert.equal(actor.target, null);
        assert.ok(Math.abs(actor.heading - Math.PI / 2) < 0.05, "heading is " + actor.heading);
    });

    it("runs faster than it walks", () =>
    {
        const walker = new Entity(1, new Appearance(library));
        const runner = new Entity(1, new Appearance(library));

        runner.setRunning(true);

        for(const actor of [walker, runner])
        {
            actor.placeAt(0, 0, OPEN_FIELD);
            actor.steer(0, 1);
            run(actor, OPEN_FIELD, 1);
        }

        assert.ok(runner.position.z > walker.position.z * 1.5);
    });

    it("gives up a target it cannot move towards", () =>
    {
        const actor = new Entity(1, new Appearance(library));

        actor.placeAt(0, 0, WALL);
        actor.moveTo({ x: 5, z: 5 });
        run(actor, WALL, 0.1);

        assert.equal(actor.target, null);
        assert.equal(actor.speed, 0);
    });
});

describe("CharacterStore", () =>
{
    it("saves and loads a character", () =>
    {
        const items = new Map();
        const storage = { getItem: (key) => items.get(key) ?? null, setItem: (key, value) => items.set(key, value) };
        const store = new CharacterStore(storage);
        const look = new Appearance(library, { name: "Tamsin", hair: "topknot" });

        assert.equal(store.save(look), true);
        assert.deepEqual(store.load(), look.toJSON());
    });

    it("loads nothing from unreadable storage", () =>
    {
        const store = new CharacterStore({ getItem: () => "{not json" });

        assert.equal(store.load(), null);
    });

    it("works without storage", () =>
    {
        const store = new CharacterStore(null);

        assert.equal(store.load(), null);
        assert.equal(store.save(new Appearance(library)), false);
    });
});
