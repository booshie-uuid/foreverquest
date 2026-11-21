import * as assert from "node:assert/strict";

export const covers = ["graphics"];

async function openCreator(page, baseUrl)
{
    await page.goto(baseUrl + "/index.html");
    await page.waitFor(() => window.foreverQuest?.isReady === true && window.foreverQuest.renderer.frameCount > 2, { timeout: 20000 });
}

export const tests =
[
    {
        name: "the Retro toggle renders 640 pixels wide and scales up",
        run: async ({ page, baseUrl, screenshot }) =>
        {
            await openCreator(page, baseUrl);
            await page.click("[data-action=retro]");

            const retro = await page.evaluate(() => (
            {
                width: window.foreverQuest.renderer.canvas.width,
                styleWidth: window.foreverQuest.renderer.canvas.clientWidth,
                isPixelated: getComputedStyle(window.foreverQuest.renderer.canvas).imageRendering === "pixelated",
                isActive: document.querySelector("[data-action=retro]").classList.contains("is-active"),
            }));

            assert.equal(retro.width, 640);
            assert.equal(retro.styleWidth, 1280);
            assert.equal(retro.isPixelated, true);
            assert.equal(retro.isActive, true);
            await screenshot("retro");

            await page.click("[data-action=retro]");

            assert.equal(await page.evaluate(() => window.foreverQuest.renderer.canvas.width), 1280);
        },
    },
    {
        name: "the moonlight casts shadows in the world",
        run: async ({ page, baseUrl }) =>
        {
            await openCreator(page, baseUrl);
            await page.click("[data-action=confirm]");
            await page.waitFor(() => window.foreverQuest.screen === "game" && window.foreverQuest.renderer.frameCount > 10, { timeout: 20000 });

            const shadows = await page.evaluate(() =>
            {
                const game = window.foreverQuest.game;

                return {
                    isEnabled: window.foreverQuest.renderer.webgl.shadowMap.enabled,
                    playerCasts: game.playerView.model.meshes.every((mesh) => mesh.castShadow),
                    moonCasts: game.world.moon.castShadow,
                };
            });

            assert.deepEqual(shadows, { isEnabled: true, playerCasts: true, moonCasts: true });
        },
    },
];
