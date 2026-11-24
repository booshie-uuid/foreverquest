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

// The mean brightness of the frame, from 0 to 1, after drawing it with the
// player's own light out, so only the zone's light shows.
function frameBrightness()
{
    const app = window.foreverQuest;
    const webgl = app.renderer.webgl;
    const gl = webgl.getContext();
    const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
    let sum = 0;

    app.materials.stepped.playerLight.value.w = 0;
    app.game.render(webgl);
    gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    for(let i = 0; i < pixels.length; i += 4) { sum += pixels[i] * 0.2126 + pixels[i + 1] * 0.7152 + pixels[i + 2] * 0.0722; }

    return sum / (pixels.length / 4) / 255;
}

export const tests =
[
    {
        name: "a sealed room that no light reaches draws no darker than the zone's base level",
        run: async ({ page, baseUrl, screenshot }) =>
        {
            await page.goto(baseUrl + "/index.html?zone=testfield&edit&view=8,1.5,8,0.4,0");
            await page.waitFor(() => window.foreverQuest?.isReady === true && window.foreverQuest.game?.editMode.isActive, { timeout: 30000 });
            await page.evaluate(() =>
            {
                const game = window.foreverQuest.game;
                const zone = game.zone;
                const [column, row] = zone.columnOf(8, 8);
                const floor = zone.surface(column, row);
                const stone = zone.blocks.number("stone");
                const cells = [];

                for(let y = floor; y <= floor + 10; y++)
                {
                    for(let z = row - 4; z <= row + 4; z++)
                    {
                        for(let x = column - 4; x <= column + 4; x++)
                        {
                            const isShell = y === floor + 10 || Math.abs(x - column) === 4 || Math.abs(z - row) === 4;

                            cells.push([x, y, z, isShell ? stone : 0]);
                        }
                    }
                }

                zone.setCells(cells);
                game.editMode.fly.setView({ x: 8, y: zone.metresY(floor + 5), z: 8, yaw: 0.4, pitch: 0.3 });
            });
            await page.waitFor(() => window.foreverQuest.game.world.isSettled, { timeout: 30000 });

            const measured = await page.evaluate((measure) =>
            {
                const materials = window.foreverQuest.materials;
                const floor = materials.stepped.ambientFloor.value.clone();
                const lit = new Function("return (" + measure + ")()")();

                materials.stepped.ambientFloor.value.setRGB(0, 0, 0);

                const unlit = new Function("return (" + measure + ")()")();

                materials.stepped.ambientFloor.value.copy(floor);

                return { lit, unlit };
            }, frameBrightness.toString());

            await screenshot("sealed-room");
            assert.ok(measured.lit > 0.012, "The sealed room draws at " + measured.lit.toFixed(3) + " of full brightness");
            assert.ok(measured.lit > measured.unlit * 2.5, "The base level barely lifts the room: " + JSON.stringify(measured));
        },
    },
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

            assert.deepEqual({ ...fog, height: fog.height.map((value) => Math.round(value * 1e6) / 1e6) }, { isCompiled: true, hasHeightFog: true, height: [0.8, 1.5, 0.02], zone: { base: 0.8, falloff: 1.5, density: 0.02 } });
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
