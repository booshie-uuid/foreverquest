import * as assert from "node:assert/strict";
import { Log } from "../../../js/log.js";

export const covers = ["streaming"];

const MAX_TRIANGLES = 1000000;
const MAX_DRAW_CALLS = 400;

async function frames(page, count)
{
    const start = await page.evaluate(() => window.foreverQuest.renderer.frameCount);

    await page.waitFor("window.foreverQuest.renderer.frameCount > " + (start + count), { timeout: 20000 });
}

// The streamer starts loading on the frame after a move.
async function settle(page)
{
    await frames(page, 2);
    await page.waitFor(() =>
    {
        const game = window.foreverQuest.game;

        return game.zone.isLoaded(game.player.position.x, game.player.position.z) && game.streamer.isIdle && game.world.isSettled;
    }, { timeout: 60000 });
    await frames(page, 3);
}

function measure()
{
    const game = window.foreverQuest.game;
    const info = window.foreverQuest.renderer.webgl.info.render;

    return {
        regions: [...game.zone.regions.keys()],
        meshes: game.world.terrainMeshes.length,
        triangles: info.triangles,
        calls: info.calls,
        isPlayerLoaded: game.zone.isLoaded(game.player.position.x, game.player.position.z),
    };
}

export const tests =
[
    {
        name: "a kilometre zone loads the regions around the player, follows the player across it, and stays inside the drawing budgets",
        timeout: 120000,
        run: async ({ page, baseUrl, screenshot }) =>
        {
            await page.goto(baseUrl + "/index.html?zone=expanse");
            await page.waitFor(() => window.foreverQuest?.isReady === true, { timeout: 30000 });
            await page.click("[data-action=confirm]");
            await page.waitFor(() => window.foreverQuest.screen === "game", { timeout: 20000 });
            await settle(page);

            const start = await page.evaluate(measure);

            await screenshot("expanse-spawn");
            await page.evaluate(() =>
            {
                const game = window.foreverQuest.game;

                game.player.placeAt(400, 380, game.zone);
            });
            await settle(page);

            const far = await page.evaluate(measure);

            await screenshot("expanse-far");

            assert.ok(start.regions.length < 40, start.regions.length + " regions loaded at the spawn point");
            assert.ok(start.regions.includes("6-6") && !start.regions.includes("10-10"), start.regions.join(" "));
            assert.ok(far.regions.includes("10-10") && !far.regions.includes("6-6"), far.regions.join(" "));
            assert.ok(far.isPlayerLoaded);

            for(const [label, sample] of [["spawn", start], ["far", far]])
            {
                assert.ok(sample.meshes > 0, label + ": no terrain meshes");
                assert.ok(sample.triangles <= MAX_TRIANGLES, label + ": " + sample.triangles + " triangles");
                assert.ok(sample.calls <= MAX_DRAW_CALLS, label + ": " + sample.calls + " draw calls");
            }

            await page.goto(baseUrl + "/index.html?zone=testfield&stats");
            await page.waitFor(() => /\d+ fps · \d+k triangles · \d+ draws/.test(document.querySelector(".frame-stats")?.textContent ?? ""), { timeout: 20000 });
            Log.info("Streaming budgets: " + JSON.stringify({ spawn: { triangles: start.triangles, calls: start.calls, meshes: start.meshes }, far: { triangles: far.triangles, calls: far.calls, meshes: far.meshes } }));
        },
    },
];
