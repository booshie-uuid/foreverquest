import * as assert from "node:assert/strict";
import * as childProcess from "node:child_process";
import * as path from "node:path";
import { describe, it } from "node:test";

const SESSION = path.resolve(import.meta.dirname, "..", "helpers", "scripted-session.js");

function session()
{
    const result = childProcess.spawnSync(process.execPath, [SESSION], { encoding: "utf8" });

    assert.equal(result.status, 0, result.stderr);

    return JSON.parse(result.stdout);
}

describe("Simulation", () =>
{
    it("runs a scripted session without Three.js and ends the same way every time", () =>
    {
        const first = session();
        const second = session();

        assert.deepEqual(first, second);
        assert.equal(first.ticks, 820);
        assert.equal(first.entities.length, 15);
        assert.ok(first.events.some((event) => event.type === "said" && event.line.includes("Tester")), "The tailor did not greet the player");
        assert.ok(first.events.some((event) => event.type === "waved" && event.id === 1), "The player did not wave");
        assert.ok(first.events.some((event) => event.type === "running"), "The run command emitted nothing");
    });
});
