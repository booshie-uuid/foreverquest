import * as assert from "node:assert/strict";

export const covers = ["movers"];

async function enterTestField(page, baseUrl)
{
    await page.goto(baseUrl + "/index.html?zone=testfield");
    await page.waitFor(() => window.foreverQuest?.isReady === true, { timeout: 20000 });
    await page.click("[data-action=confirm]");
    await page.waitFor(() => window.foreverQuest.screen === "game" && window.foreverQuest.renderer.frameCount > 10, { timeout: 20000 });
}

export const tests =
[
    {
        name: "clicking the lever walks the player to it and raises the portcullis",
        run: async ({ page, baseUrl, screenshot }) =>
        {
            await enterTestField(page, baseUrl);

            await page.evaluate(() =>
            {
                const game = window.foreverQuest.game;

                game.player.placeAt(-4, 9, game.zone);
                game.rig.yaw = 0;
                game.rig.pitch = 0.25;
                game.rig.setDistance(3);
            });

            const start = await page.evaluate(() => window.foreverQuest.renderer.frameCount);

            await page.waitFor("window.foreverQuest.renderer.frameCount > " + (start + 20), { timeout: 20000 });
            await page.evaluate(() =>
            {
                const game = window.foreverQuest.game;
                const canvas = window.foreverQuest.renderer.canvas;
                const lever = game.zone.objects.find((entry) => entry.object === "leverBase");
                const point = new game.camera.position.constructor(lever.x, lever.y + 0.2, lever.z).project(game.camera);
                const at = { clientX: (point.x * 0.5 + 0.5) * game.size.width, clientY: (-point.y * 0.5 + 0.5) * game.size.height, bubbles: true };

                canvas.dispatchEvent(new PointerEvent("pointerdown", { ...at, button: 0, buttons: 1 }));
                window.dispatchEvent(new PointerEvent("pointerup", { ...at, button: 0, buttons: 0 }));
            });

            await page.waitFor(() => window.foreverQuest.game.sim.movers.mover("gate").progress === 1, { timeout: 20000 });
            await screenshot("portcullis-raised");

            const result = await page.evaluate(() =>
            {
                const game = window.foreverQuest.game;
                const lever = game.zone.objects.find((entry) => entry.object === "leverBase");
                const opening = game.sim.movers.mover("gate").entry.cells[0];

                return { reach: Math.hypot(game.player.position.x - lever.x, game.player.position.z - lever.z), isOpen: !game.zone.isSolid(...opening), handle: game.sim.movers.mover("gateLever").target };
            });

            assert.ok(result.reach < 2.5, "The player did not walk to the lever: " + result.reach);
            assert.deepEqual([result.isOpen, result.handle], [true, 1]);
        },
    },
    {
        name: "a lever is picked from beside it, but not from under the ground",
        run: async ({ page, baseUrl }) =>
        {
            await enterTestField(page, baseUrl);

            const picked = await page.evaluate(() =>
            {
                const game = window.foreverQuest.game;
                const lever = game.zone.objects.find((entry) => entry.object === "leverBase");
                const ray = game.raycaster.ray;
                const pick = (origin, direction) =>
                {
                    ray.origin.set(...origin);
                    ray.direction.set(...direction).normalize();

                    return game.pickLever();
                };

                return {
                    index: game.zone.objects.indexOf(lever),
                    beside: pick([lever.x, lever.y + 0.1, lever.z + 3], [0, 0, -1]),
                    under: pick([lever.x, lever.y - 2, lever.z], [0, 1, 0]),
                };
            });

            assert.deepEqual([picked.beside, picked.under], [picked.index, null]);
        },
    },
];
