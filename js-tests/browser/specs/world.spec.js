import * as assert from "node:assert/strict";

export const covers = ["world"];

async function enterWorld(page, baseUrl)
{
    await page.goto(baseUrl + "/index.html");
    await page.waitFor(() => window.foreverQuest?.isReady === true, { timeout: 20000 });
    await page.click("[data-action=confirm]");
    await page.waitFor(() => window.foreverQuest.screen === "game" && window.foreverQuest.renderer.frameCount > 10, { timeout: 20000 });
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
                    actors: window.foreverQuest.game.actors.length,
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
        name: "holding W walks the player away from the camera",
        run: async ({ page, baseUrl }) =>
        {
            await enterWorld(page, baseUrl);

            const before = await page.evaluate(playerPosition);

            await page.press("w", 1500);

            const after = await page.evaluate(playerPosition);

            assert.ok(before.z - after.z > 0.8, "The player moved from z " + before.z + " to " + after.z);
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
                const target = game.player.position.clone();

                target.x -= 2.5;
                target.y = game.world.heightAt(target.x, target.z);
                target.project(game.camera);

                return { x: (target.x * 0.5 + 0.5) * game.size.width, y: (-target.y * 0.5 + 0.5) * game.size.height, goal: game.player.position.x - 2.5 };
            });

            await page.clickAt(point.x, point.y);
            await page.waitFor(() => window.foreverQuest.game.player.target === null && window.foreverQuest.game.player.speed < 0.05, { timeout: 8000 });

            const after = await page.evaluate(playerPosition);

            assert.ok(Math.abs(after.x - point.goal) < 0.6, "The player stopped at x " + after.x + ", not near " + point.goal);
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
                const npc = game.npcs.find((actor) => actor.brain.role === "tailor");
                const point = npc.position.clone();

                point.y += npc.model.plan.height * 0.6;
                point.project(game.camera);

                return { x: (point.x * 0.5 + 0.5) * game.size.width, y: (-point.y * 0.5 + 0.5) * game.size.height };
            });

            await page.clickAt(tailor.x, tailor.y);
            await page.waitFor(() => window.foreverQuest.screen === "creator", { timeout: 15000 });

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
