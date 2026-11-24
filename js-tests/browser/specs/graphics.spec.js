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
        name: "the terrain carries light levels, and the player takes the light of the cell it stands in",
        run: async ({ page, baseUrl }) =>
        {
            await enterWorld(page, baseUrl);

            const light = await page.evaluate(() =>
            {
                const game = window.foreverQuest.game;
                const view = game.playerView;
                const expected = window.foreverQuest.materials.colours(15, 0).sky;

                return {
                    hasLevels: game.world.terrainMeshes.every((mesh) => mesh.geometry.getAttribute("light")?.itemSize === 2),
                    isOutdoorSky: view.cell.cellSky.value.equals(expected),
                };
            });

            assert.deepEqual(light, { hasLevels: true, isOutdoorSky: true });
        },
    },
    {
        name: "the Day toggle brings up the sun and brightens the sky",
        run: async ({ page, baseUrl, screenshot }) =>
        {
            await enterWorld(page, baseUrl);

            const read = () => page.evaluate(() =>
            {
                const world = window.foreverQuest.game.world;

                return {
                    sky: world.scene.background.getHSL({}).l,
                    sun: world.moon.intensity,
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
            assert.deepEqual([night.isActive, day.isActive], [false, true]);
        },
    },
    {
        name: "height fog compiles into the terrain's shader, with the zone's settings",
        run: async ({ page, baseUrl }) =>
        {
            await enterWorld(page, baseUrl);

            const fog = await page.evaluate(() =>
            {
                const { renderer, materials, game } = window.foreverQuest;
                const gl = renderer.webgl.getContext();
                const program = renderer.webgl.properties.get(materials.terrain).currentProgram.program;
                const sources = gl.getAttachedShaders(program).map((shader) => gl.getShaderSource(shader)).join("\n");

                return {
                    isCompiled: gl.getProgramParameter(program, gl.LINK_STATUS),
                    hasHeightFog: sources.includes("fogHeight"),
                    height: materials.fog.heightFog.value.toArray().slice(0, 3),
                    zone: game.zone.lighting.fog.height,
                };
            });

            assert.deepEqual(fog, { isCompiled: true, hasHeightFog: true, height: [0.5, 1.5, 0.03], zone: { base: 0.5, falloff: 1.5, density: 0.03 } });
        },
    },
    {
        name: "the Grid toggle outlines the cubes in the terrain's shader",
        run: async ({ page, baseUrl, screenshot }) =>
        {
            await enterWorld(page, baseUrl);
            await page.click(".hud [data-action=grid]");

            const start = await page.evaluate(() => window.foreverQuest.renderer.frameCount);

            await page.waitFor("window.foreverQuest.renderer.frameCount > " + (start + 3), { timeout: 20000 });
            await screenshot("grid");

            const grid = await page.evaluate(() =>
            {
                const { renderer, materials } = window.foreverQuest;
                const gl = renderer.webgl.getContext();
                const program = renderer.webgl.properties.get(materials.terrain).currentProgram.program;
                const sources = gl.getAttachedShaders(program).map((shader) => gl.getShaderSource(shader)).join("\n");

                return { isOn: materials.stepped.cubeGrid.value, hasLines: sources.includes("cubeGrid"), isActive: document.querySelector(".hud [data-action=grid]").classList.contains("is-active") };
            });

            assert.deepEqual(grid, { isOn: 1, hasLines: true, isActive: true });
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
