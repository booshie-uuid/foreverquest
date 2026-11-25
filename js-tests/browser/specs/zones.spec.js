import * as assert from "node:assert/strict";

export const covers = ["zones"];

async function enter(page, baseUrl, query)
{
    await page.goto(baseUrl + "/index.html" + query);
    await page.waitFor(() => window.foreverQuest?.isReady === true, { timeout: 20000 });
    await page.click("[data-action=confirm]");
    await page.waitFor(() => window.foreverQuest.screen === "game" && window.foreverQuest.renderer.frameCount > 5, { timeout: 20000 });
}

function state()
{
    const game = window.foreverQuest.game;

    return {
        zone: game.zone.id,
        npcs: game.npcs.map((npc) => npc.name),
        plates: document.querySelectorAll(".nameplate").length,
        player: { x: game.player.position.x, z: game.player.position.z },
        isInScene: game.playerView.root.parent === game.world.scene,
    };
}

export const tests =
[
    {
        name: "the game starts in the zone the address names",
        run: async ({ page, baseUrl, screenshot }) =>
        {
            await enter(page, baseUrl, "?zone=testfield");

            const field = await page.evaluate(state);

            assert.equal(field.zone, "testfield");
            assert.equal(field.npcs.length, 3);
            assert.ok(field.npcs.includes("Mirelle"));
            assert.deepEqual(field.player, { x: 0, z: 6 });
            await screenshot("testfield");
        },
    },
    {
        name: "the zone picker takes the player to the zone chosen",
        run: async ({ page, baseUrl }) =>
        {
            await enter(page, baseUrl, "");

            const options = await page.evaluate(() => [...document.querySelectorAll(".hud [data-action=zone] option")].map((option) => option.value));

            await page.evaluate(() =>
            {
                const picker = document.querySelector(".hud [data-action=zone]");

                picker.value = "testfield";
                picker.dispatchEvent(new Event("change"));
            });
            await page.waitFor(() => window.foreverQuest.game.zone.id === "testfield", { timeout: 20000 });

            const picked = await page.evaluate(() => document.querySelector(".hud [data-action=zone]").value);

            assert.deepEqual(options, ["expanse", "hearthmere", "testfield", "tutorial"]);
            assert.equal(picked, "testfield");
        },
    },
    {
        name: "travelling loads the next zone, frees the last, and keeps the player",
        run: async ({ page, baseUrl }) =>
        {
            await enter(page, baseUrl, "?zone=testfield");

            const freed = await page.evaluate(async () =>
            {
                const app = window.foreverQuest;
                const before = app.game.world;

                await app.travel("hearthmere");

                return { isDisposed: before.isDisposed, children: before.scene.children.length };
            });

            await page.waitFor(() => window.foreverQuest.renderer.frameCount > 20);

            const village = await page.evaluate(state);

            assert.deepEqual(freed, { isDisposed: true, children: 0 });
            assert.equal(village.zone, "hearthmere");
            assert.equal(village.npcs.length, 15);
            assert.equal(village.plates, 16);
            assert.equal(village.isInScene, true);
            assert.deepEqual(village.player, { x: -4, z: 12 });
        },
    },
];
