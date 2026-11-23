import * as assert from "node:assert/strict";

export const covers = ["world"];

async function enterWorld(page, baseUrl)
{
    await page.goto(baseUrl + "/index.html");
    await page.waitFor(() => window.foreverQuest?.isReady === true, { timeout: 20000 });
    await page.click("[data-action=confirm]");
    await page.waitFor(() => window.foreverQuest.screen === "game" && window.foreverQuest.renderer.frameCount > 10, { timeout: 20000 });
    await page.evaluate(() => window.foreverQuest.game.rig.setDistance(9));
    await page.waitFor(() => window.foreverQuest.game.rig.shown > 8, { timeout: 20000 });
}

function playerPosition()
{
    const position = window.foreverQuest.game.player.position;

    return { x: position.x, z: position.z };
}

export const tests =
[
    {
        name: "entering the world shows the player, villagers and their nameplates",
        run: async ({ page, baseUrl, screenshot }) =>
        {
            await enterWorld(page, baseUrl);

            const state = await page.evaluate(() =>
            {
                const plates = [...document.querySelectorAll(".nameplate")];

                return {
                    actors: window.foreverQuest.game.views.size,
                    visiblePlates: plates.filter((plate) => !plate.hidden).length,
                    hudName: document.querySelector(".hud-name strong").textContent,
                };
            });

            assert.ok(state.actors >= 10, state.actors + " actors");
            assert.ok(state.visiblePlates >= 4, state.visiblePlates + " visible nameplates");
            assert.equal(state.hudName, "Adventurer");
            await screenshot("village");
        },
    },
    {
        name: "the game starts in first person, and the wheel zooms out to third person",
        run: async ({ page, baseUrl }) =>
        {
            await page.goto(baseUrl + "/index.html");
            await page.waitFor(() => window.foreverQuest?.isReady === true, { timeout: 20000 });
            await page.click("[data-action=confirm]");
            await page.waitFor(() => window.foreverQuest.screen === "game" && window.foreverQuest.renderer.frameCount > 10, { timeout: 20000 });

            const first = await page.evaluate(() => ({ isFirstPerson: window.foreverQuest.game.rig.isFirstPerson, isPlayerShown: window.foreverQuest.game.playerView.root.visible }));

            await page.evaluate(() => window.foreverQuest.game.rig.zoom(1.1));
            await page.waitFor(() => !window.foreverQuest.game.rig.isFirstPerson && window.foreverQuest.game.playerView.root.visible, { timeout: 20000 });

            assert.deepEqual(first, { isFirstPerson: true, isPlayerShown: false });
        },
    },
    {
        name: "holding W walks the player away from the camera",
        run: async ({ page, baseUrl }) =>
        {
            await enterWorld(page, baseUrl);

            await page.evaluate(() => window.foreverQuest.game.pause());

            const before = await page.evaluate(playerPosition);
            const frame = await page.evaluate(() => window.foreverQuest.renderer.frameCount);

            await page.keyDown("w");
            await page.waitFor("window.foreverQuest.renderer.frameCount > " + (frame + 2));
            await page.evaluate(() => window.foreverQuest.game.stepTicks(30));
            await page.keyUp("w");

            const after = await page.evaluate(playerPosition);

            assert.ok(before.z - after.z > 2.5, "In 1.5 s of ticks the player moved from z " + before.z + " to " + after.z);
        },
    },
    {
        name: "clicking the ground walks the player to that spot",
        run: async ({ page, baseUrl }) =>
        {
            await enterWorld(page, baseUrl);

            const point = await page.evaluate(() =>
            {
                const game = window.foreverQuest.game;
                const target = game.playerView.position.clone();

                game.pause();
                target.x -= 2.5;
                target.y = game.zone.heightAt(target.x, target.z);
                target.project(game.camera);

                return { x: (target.x * 0.5 + 0.5) * game.size.width, y: (-target.y * 0.5 + 0.5) * game.size.height, goal: game.player.position.x - 2.5 };
            });

            await page.clickAt(point.x, point.y);

            const ticks = await page.evaluate(() =>
            {
                const game = window.foreverQuest.game;
                let count = 0;

                do
                {
                    game.stepTicks(1);
                    count++;
                }
                while((game.player.target !== null || game.player.speed >= 0.05) && count < 200);

                return count;
            });
            const after = await page.evaluate(playerPosition);

            assert.ok(ticks < 200, "The player was still walking after 10 s of ticks");

            assert.ok(Math.abs(after.x - point.goal) < 0.6, "The player stopped at x " + after.x + ", not near " + point.goal);
        },
    },
    {
        name: "walking through the inn's door leads inside, where walls pull the camera in rather than hide the player",
        run: async ({ page, baseUrl, screenshot }) =>
        {
            await enterWorld(page, baseUrl);

            const result = await page.evaluate(() =>
            {
                const game = window.foreverQuest.game;
                let count = 0;

                game.player.placeAt(9.35, -4.6, game.zone);
                game.pause();
                game.sim.command({ type: "moveTo", x: 8.45, z: -8.3 });

                do
                {
                    game.stepTicks(1);
                    count++;
                }
                while((game.player.target !== null || game.player.speed >= 0.05) && count < 300);

                const { x, y, z } = game.player.position;

                return { count, ceiling: game.zone.raycast({ x, y: y + 1.7, z }, { x: 0, y: 1, z: 0 }, 10), y, ground: game.zone.groundAt(x, z) };
            });

            await page.evaluate(() => { window.foreverQuest.game.isPaused = false; });

            const start = await page.evaluate(() => window.foreverQuest.renderer.frameCount);

            await page.waitFor("window.foreverQuest.renderer.frameCount > " + (start + 20), { timeout: 20000 });
            await screenshot("inside-the-inn");

            const view = await page.evaluate(() =>
            {
                const game = window.foreverQuest.game;
                const position = game.camera.position;
                const [column, row] = game.zone.columnOf(position.x, position.z);

                return { shown: game.rig.shown, isCameraInWall: game.zone.isSolid(column, Math.floor(game.zone.cellY(position.y)), row) };
            });

            assert.ok(result.ceiling < 1, "The player stopped outside the inn: " + JSON.stringify(result));
            assert.ok(result.y > result.ground, "The player is not on the inn's raised floor");
            assert.ok(view.shown < 4, "The camera stayed " + view.shown + " metres out, behind the walls");
            assert.equal(view.isCameraInWall, false);
        },
    },
    {
        name: "talking to the tailor opens the creator, and saving restyles the player",
        run: async ({ page, baseUrl, screenshot }) =>
        {
            await enterWorld(page, baseUrl);

            const tailor = await page.evaluate(() =>
            {
                const game = window.foreverQuest.game;
                const view = [...game.views.values()].find((entry) => entry.entity.brain?.role === "tailor");
                const point = view.position.clone();

                game.pause();
                point.y += view.model.plan.height * 0.6;
                point.project(game.camera);

                return { x: (point.x * 0.5 + 0.5) * game.size.width, y: (-point.y * 0.5 + 0.5) * game.size.height };
            });

            await page.clickAt(tailor.x, tailor.y);
            await page.evaluate(() =>
            {
                for(let i = 0; i < 600 && window.foreverQuest.screen !== "creator"; i++) { window.foreverQuest.game.stepTicks(1); }
            });

            assert.equal(await page.evaluate(() => window.foreverQuest.screen), "creator");

            const chat = await page.evaluate(() => document.querySelector(".chat").textContent);

            assert.match(chat, /Mirelle: You look half-dead/);

            await page.click("[data-tab=head]");
            await page.click("[aria-label='Next Hair']");
            await page.click("[data-action=confirm]");
            await page.waitFor(() => window.foreverQuest.screen === "game");

            const result = await page.evaluate(() =>
            {
                return {
                    hair: window.foreverQuest.game.player.appearance.get("hair"),
                    saved: JSON.parse(localStorage.getItem("foreverquest.character")).hair,
                };
            });

            assert.equal(result.hair, "swept");
            assert.equal(result.saved, "swept");
            await screenshot("restyled");
        },
    },
];
