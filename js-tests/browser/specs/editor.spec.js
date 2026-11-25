import * as assert from "node:assert/strict";

export const covers = ["editor"];

// The test field from above its well, looking down at the ground north of it.
const VIEW = "0,5,6,0,0.7";

async function openEditor(page, baseUrl)
{
    await page.goto(baseUrl + "/index.html?zone=testfield&edit&view=" + VIEW);
    await page.waitFor(() => window.foreverQuest?.isReady === true && window.foreverQuest.game?.editMode.isActive, { timeout: 30000 });
    await page.waitFor(() => window.foreverQuest.game.world.isSettled, { timeout: 30000 });
}

// The editor's session lives in the server, so each test throws its changes
// away for the next.
async function discard(page)
{
    await page.evaluate(() => fetch("editor/testfield/discard", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }));
}

// The pixel where a cell's middle shows.
function screenPoint(page, cell)
{
    return page.evaluate(([column, y, row]) =>
    {
        const game = window.foreverQuest.game;
        const zone = game.zone;
        const point = new game.camera.position.constructor((column + 0.5) / 3 - zone.half, zone.metresY(y + 0.5), (row + 0.5) / 3 - zone.half);
        const projected = point.project(game.camera);

        return [(projected.x * 0.5 + 0.5) * game.size.width, (-projected.y * 0.5 + 0.5) * game.size.height];
    }, cell);
}

export const tests =
[
    {
        name: "F8 opens the editor over the game, and pressing it again lands the player where the camera looks",
        run: async ({ page, baseUrl }) =>
        {
            await page.goto(baseUrl + "/index.html?zone=testfield");
            await page.waitFor(() => window.foreverQuest?.isReady === true, { timeout: 20000 });
            await page.click("[data-action=confirm]");
            await page.waitFor(() => window.foreverQuest.screen === "game" && window.foreverQuest.renderer.frameCount > 10, { timeout: 20000 });
            await page.press("F8");
            await page.waitFor(() => window.foreverQuest.game.editMode.isActive, { timeout: 20000 });

            const opened = await page.evaluate(() => ({ isPaused: window.foreverQuest.game.isPaused, hasBar: !document.querySelector(".editor").hidden, isHudHidden: document.querySelector(".hud").hidden }));

            await page.evaluate(() => window.foreverQuest.game.editMode.fly.setView({ x: 6, y: 4, z: 6, yaw: 0, pitch: 0.6 }));
            await page.press("F8");

            const landed = await page.evaluate(() => ({ isActive: window.foreverQuest.game.editMode.isActive, isPaused: window.foreverQuest.game.isPaused, x: window.foreverQuest.game.player.position.x, z: window.foreverQuest.game.player.position.z }));

            assert.deepEqual(opened, { isPaused: true, hasBar: true, isHudHidden: true });
            assert.deepEqual([landed.isActive, landed.isPaused], [false, false]);
            assert.ok(Math.abs(landed.x - 6) < 1.5 && landed.z < 6 && landed.z > -2, "The player landed at " + landed.x + ", " + landed.z);
        },
    },
    {
        name: "a click adds a cube that the server bakes into the zone, and undo takes it away",
        run: async ({ page, baseUrl, screenshot }) =>
        {
            await openEditor(page, baseUrl);

            try
            {
                const target = await page.evaluate(() =>
                {
                    const hit = window.foreverQuest.game.editMode.pickCell(640, 470);

                    return hit.cell.map((value, axis) => value + hit.normal[axis]);
                });

                await page.clickAt(640, 470);
                await page.waitFor(() => window.foreverQuest.game.editMode.state.steps === 1 && !window.foreverQuest.game.editMode.isBusy, { timeout: 20000 });
                await page.waitFor(() => window.foreverQuest.game.world.isSettled, { timeout: 20000 });
                await screenshot("cube-added");

                const added = await page.evaluate(async ([x, y, z]) =>
                {
                    const edit = window.foreverQuest.game.editMode;
                    const codec = await import("/js/sim/region-codec.js");
                    const region = codec.decode(await window.foreverQuest.game.streamer.source.inflated("zones/testfield/0-0.bin"));
                    const chunk = region.chunks.find((entry) => entry.x === Math.floor(x / 32) && entry.y === Math.floor(y / 32) && entry.z === Math.floor(z / 32));
                    const served = chunk.cells ? chunk.cells[((y % 32) * 32 + (z % 32)) * 32 + (x % 32)] : chunk.uniform;

                    return { block: edit.zone.blockAt(x, y, z), served, cobble: edit.blocks.number("cobble"), isDirty: edit.state.isDirty };
                }, target);

                await page.evaluate(() => window.foreverQuest.game.editMode.undo());
                await page.waitFor(() => window.foreverQuest.game.editMode.state.steps === 0 && !window.foreverQuest.game.editMode.isBusy, { timeout: 20000 });

                const undone = await page.evaluate((cell) => window.foreverQuest.game.zone.blockAt(...cell), target);

                assert.equal(added.block, added.cobble, "The cube was not added");
                assert.equal(added.served, added.cobble, "The server did not bake the cube into the region it serves");
                assert.equal(added.isDirty, true);
                assert.equal(undone, 0, "Undo left the cube");
            }
            finally
            {
                await discard(page);
            }
        },
    },
    {
        name: "selecting the well and pressing the up arrow moves it a cube away from the camera",
        run: async ({ page, baseUrl }) =>
        {
            await openEditor(page, baseUrl);

            try
            {
                await page.press("2");

                const well = await page.evaluate(() => window.foreverQuest.game.zone.objects.find((entry) => entry.name === "well"));
                const [x, y] = await screenPoint(page, [(well.box[0] + well.box[3]) >> 1, well.box[1] + 1, well.box[5]]);

                await page.clickAt(x, y);
                await page.waitFor(() => window.foreverQuest.game.editMode.tools.select.entry?.name === "well", { timeout: 20000 });
                await page.press("ArrowUp");
                await page.waitFor(() => window.foreverQuest.game.editMode.state.steps === 1 && !window.foreverQuest.game.editMode.isBusy, { timeout: 20000 });

                const moved = await page.evaluate(() => window.foreverQuest.game.editMode.tools.select.entry.box);

                assert.deepEqual(moved, [well.box[0], well.box[1], well.box[2] - 1, well.box[3], well.box[4], well.box[5] - 1]);
            }
            finally
            {
                await discard(page);
            }
        },
    },
    {
        name: "a note pinned on a cube keeps the camera's view and shows its pin",
        run: async ({ page, baseUrl }) =>
        {
            await openEditor(page, baseUrl);
            await page.press("3");
            await page.clickAt(600, 500);
            await page.waitFor(() => document.querySelector(".editor-note-text") !== null, { timeout: 20000 });
            await page.evaluate(() =>
            {
                const text = document.querySelector(".editor-note-text");

                text.value = "Move the well back a metre.";
                text.dispatchEvent(new Event("input"));
            });
            await page.click("[data-action=note-save]");
            await page.waitFor(() => document.querySelector(".editor-pin") !== null, { timeout: 20000 });

            const saved = await page.evaluate(async () => (await fetch("editor/testfield/notes")).json());

            assert.equal(saved.length, 1);
            assert.deepEqual([saved[0].text, saved[0].status, saved[0].view], ["Move the well back a metre.", "open", { x: 0, y: 5, z: 6, yaw: 0, pitch: 0.7 }]);
        },
    },
    {
        name: "a new zone opens on its terrain recipe and map, takes a flat area dragged on the map without moving the camera, moves the camera to an empty spot clicked, and Preview bakes a changed base into the world",
        timeout: 120000,
        run: async ({ page, baseUrl, screenshot }) =>
        {
            await openEditor(page, baseUrl);
            await page.click("[data-action=new-zone]");
            await page.evaluate(() =>
            {
                document.querySelector(".editor-card [data-key=id]").value = "specVale";
                document.querySelector(".editor-card [data-key=name]").value = "the Spec Vale";
                document.querySelector(".editor-card select").value = "256";
            });
            await page.click("[data-action=new-zone-create]");

            try
            {
                await page.waitFor(() => location.search.includes("zone=specVale") && window.foreverQuest?.isReady === true && window.foreverQuest.game?.editMode.isActive, { timeout: 60000 });
                await page.waitFor(() => window.foreverQuest.game.world.isSettled && window.foreverQuest.game.editMode.tools.terrain.image.complete, { timeout: 30000 });

                const opened = await page.evaluate(() =>
                {
                    const map = document.querySelector(".editor-map");
                    const pixels = map.getContext("2d").getImageData(0, 0, map.width, map.height).data;
                    let drawn = 0;

                    for(let i = 3; i < pixels.length; i += 4) { if(pixels[i] > 0) { drawn++; } }

                    return { modes: [...document.querySelectorAll("[data-action^=mode-]")].map((button) => button.dataset.action), drawn: drawn / (map.width * map.height) };
                });

                assert.deepEqual(opened.modes, ["mode-terrain", "mode-select", "mode-notes"]);
                assert.ok(opened.drawn > 0.95, "The map is drawn over only " + opened.drawn + " of its canvas");

                const box = await page.evaluate(() => { const rect = document.querySelector(".editor-map").getBoundingClientRect(); return [rect.left, rect.top, rect.width]; });

                const before = await page.evaluate(() => window.foreverQuest.game.editMode.fly.view);

                await page.click("[data-action=add-flat]");
                await page.mouseDrag(box[0] + box[2] * 0.4, box[1] + box[2] * 0.4, box[0] + box[2] * 0.6, box[1] + box[2] * 0.6);

                const flat = await page.evaluate(() => window.foreverQuest.game.editMode.tools.terrain.recipe.features[0]);

                assert.deepEqual([flat.kind, Math.abs(flat.x) <= 2, Math.abs(flat.z) <= 2, Math.abs(flat.width - 52) <= 2], ["flat", true, true, true]);
                assert.deepEqual(await page.evaluate(() => window.foreverQuest.game.editMode.fly.view), before, "Drawing a feature moved the camera");

                await page.click("[data-action=remove-feature]");
                await page.clickAt(box[0] + box[2] * 0.75, box[1] + box[2] * 0.25);

                const flown = await page.evaluate(() => window.foreverQuest.game.editMode.fly.view);

                assert.ok(Math.abs(flown.x - 64) <= 2 && Math.abs(flown.z + 64) <= 2, "A click on an empty spot of the map did not move the camera there: " + JSON.stringify(flown));

                await page.evaluate(() =>
                {
                    const kind = document.querySelector(".editor-palette select[data-key=kind]");

                    kind.value = "flat";
                    kind.dispatchEvent(new Event("change"));
                });
                await page.click("[data-action=terrain-preview]");
                await page.waitFor(() => window.foreverQuest.game.editMode.state.steps === 1 && !window.foreverQuest.game.editMode.isBusy, { timeout: 60000 });
                await page.waitFor(() => window.foreverQuest.game.world.isSettled, { timeout: 30000 });

                const ground = await page.evaluate(() => { const zone = window.foreverQuest.game.zone; return zone.surface(zone.columns / 2, zone.columns / 2) - zone.base; });

                assert.equal(ground, 6, "The flat base of 2 m did not reach the world");
                await screenshot("terrain");
            }
            finally
            {
                await page.evaluate(() => fetch("editor/specVale/discard", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }));
            }
        },
    },
];
