import * as assert from "node:assert/strict";

export const covers = ["constructs"];

export const tests =
[
    {
        name: "a sleeping suit of armour shows no nameplate; coming near wakes it, and it pursues and shoves the player back, as the chat says",
        run: async ({ page, baseUrl, screenshot }) =>
        {
            await page.goto(baseUrl + "/index.html?zone=testfield");
            await page.waitFor(() => window.foreverQuest?.isReady === true, { timeout: 20000 });
            await page.click("[data-action=confirm]");
            await page.waitFor(() => window.foreverQuest.screen === "game" && window.foreverQuest.renderer.frameCount > 10, { timeout: 20000 });

            const asleep = await page.evaluate(() =>
            {
                const game = window.foreverQuest.game;
                const armour = game.sim.constructs.find((entity) => entity.construct.id === "armour");

                game.player.placeAt(armour.position.x, armour.position.z + 5, game.zone, Math.PI);
                game.rig.yaw = 0;
                game.rig.setDistance(5);

                return { id: armour.id, state: armour.brain.state };
            });
            const start = await page.evaluate(() => window.foreverQuest.renderer.frameCount);

            await page.waitFor("window.foreverQuest.renderer.frameCount > " + (start + 10), { timeout: 20000 });

            const isPlateShown = await page.evaluate(() => [...document.querySelectorAll(".nameplate")].some((plate) => !plate.hidden && plate.textContent === "suit of armour"));

            await page.evaluate(() =>
            {
                const game = window.foreverQuest.game;
                const armour = game.sim.constructs.find((entity) => entity.construct.id === "armour");

                game.player.placeAt(armour.position.x, armour.position.z + 2.5, game.zone, Math.PI);
            });
            await page.waitFor(() => document.querySelector(".panel.chat")?.textContent.includes("shoves you back"), { timeout: 20000 });
            await screenshot("armour-shoves");

            const chat = await page.evaluate(() => document.querySelector(".panel.chat").textContent);

            assert.equal(asleep.state, "dormant");
            assert.equal(isPlateShown, false, "The sleeping armour shows its nameplate");
            assert.ok(chat.includes("The suit of armour stirs."), chat);
        },
    },
    {
        name: "in the editor, clicking a construct selects it, its inspector sets its wake distance, and the Constructs tab lists the four",
        run: async ({ page, baseUrl }) =>
        {
            await page.goto(baseUrl + "/index.html?zone=testfield&edit&view=-3,1.4,3,0,0.05");
            await page.waitFor(() => window.foreverQuest?.isReady === true && window.foreverQuest.game?.editMode.isActive, { timeout: 30000 });
            await page.waitFor(() => window.foreverQuest.game.world.isSettled, { timeout: 30000 });

            try
            {
                await page.press("2");

                const at = await page.evaluate(() =>
                {
                    const game = window.foreverQuest.game;
                    const armour = game.sim.constructs.find((entity) => entity.construct.id === "armour");
                    const point = new game.camera.position.constructor(armour.position.x, armour.position.y + 1, armour.position.z).project(game.camera);

                    return [(point.x * 0.5 + 0.5) * game.size.width, (-point.y * 0.5 + 0.5) * game.size.height];
                });

                await page.clickAt(...at);
                await page.waitFor(() => window.foreverQuest.game.editMode.tools.objects.entry?.construct === "armour", { timeout: 20000 });
                await page.evaluate(() =>
                {
                    const input = document.querySelector(".editor-inspector [data-key=wake-near]");

                    input.value = "5";
                    input.dispatchEvent(new Event("change"));
                });
                await page.waitFor(() => window.foreverQuest.game.editMode.state.steps === 1 && !window.foreverQuest.game.editMode.isBusy, { timeout: 20000 });

                const result = await page.evaluate(() =>
                {
                    const game = window.foreverQuest.game;
                    const armour = game.sim.constructs.find((entity) => entity.construct.construct === "armour");

                    game.editMode.tools.objects.setTab("constructs");

                    return { near: armour.construct.wake?.near, isAsleep: armour.brain.isDormant, listed: [...document.querySelectorAll(".editor-palette .editor-item")].map((item) => item.dataset.id) };
                });

                assert.deepEqual(result, { near: 5, isAsleep: true, listed: ["armour", "gargoyle", "golem", "mimic"] });
            }
            finally
            {
                await page.evaluate(() => fetch("editor/testfield/discard", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }));
            }
        },
    },
];
