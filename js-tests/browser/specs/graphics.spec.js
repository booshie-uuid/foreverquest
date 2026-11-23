import * as assert from "node:assert/strict";

export const covers = ["graphics"];

async function openCreator(page, baseUrl)
{
    await page.goto(baseUrl + "/index.html");
    await page.waitFor(() => window.foreverQuest?.isReady === true && window.foreverQuest.renderer.frameCount > 2, { timeout: 20000 });
}

async function enterWorld(page, baseUrl)
{
    await openCreator(page, baseUrl);
    await page.click("[data-action=confirm]");
    await page.waitFor(() => window.foreverQuest.screen === "game" && window.foreverQuest.renderer.frameCount > 10, { timeout: 20000 });
}

export const tests =
[
    {
        name: "the world starts in stepped light, which the Stepped toggle turns off",
        run: async ({ page, baseUrl }) =>
        {
            await enterWorld(page, baseUrl);

            const before = await page.evaluate(() => (
            {
                uniform: window.foreverQuest.materials.stepped.steppedLight.value,
                isActive: document.querySelector(".hud [data-action=stepped]").classList.contains("is-active"),
                hasLight: window.foreverQuest.game.world.terrainMeshes.every((mesh) => mesh.geometry.getAttribute("light")?.itemSize === 2),
            }));

            await page.click(".hud [data-action=stepped]");

            assert.deepEqual(before, { uniform: 1, isActive: true, hasLight: true });
            assert.equal(await page.evaluate(() => window.foreverQuest.materials.stepped.steppedLight.value), 0);
        },
    },
    {
        name: "the Day toggle brings up the sun, brightens the sky and puts out the lamps",
        run: async ({ page, baseUrl, screenshot }) =>
        {
            await enterWorld(page, baseUrl);

            const read = () => page.evaluate(() =>
            {
                const world = window.foreverQuest.game.world;

                return {
                    sky: world.scene.background.getHSL({}).l,
                    sun: world.moon.intensity,
                    lit: world.lamps.filter((lamp) => lamp.intensity > 0).length,
                    isActive: document.querySelector(".hud [data-action=day]").classList.contains("is-active"),
                };
            });
            const night = await read();

            await page.click(".hud [data-action=day]");

            const start = await page.evaluate(() => window.foreverQuest.renderer.frameCount);

            await page.waitFor("window.foreverQuest.renderer.frameCount > " + (start + 3), { timeout: 20000 });

            const day = await read();

            await screenshot("day");

            assert.ok(day.sky > night.sky + 0.2, "The sky stayed dark: " + night.sky + " to " + day.sky);
            assert.ok(day.sun > night.sun, "The sun is no brighter than the moon");
            assert.deepEqual([night.lit > 0, day.lit, night.isActive, day.isActive], [true, 0, false, true]);
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
