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
        name: "the brush paints sand on the ground with a clean edge, weathers it and raises it with a square brush, each stroke one step, while a right-drag still looks around",
        timeout: 60000,
        run: async ({ page, baseUrl, screenshot }) =>
        {
            await openEditor(page, baseUrl);

            try
            {
                const column = await page.evaluate(() => window.foreverQuest.game.editMode.pickCell(640, 470).cell);
                const ground = () => page.evaluate(([x, , z]) => window.foreverQuest.game.zone.grounds[z * window.foreverQuest.game.zone.columns + x], column);
                const stroke = async (steps) =>
                {
                    await page.mouseDrag(620, 470, 660, 470);
                    await page.waitFor("window.foreverQuest.game.editMode.state.steps === " + steps + " && !window.foreverQuest.game.editMode.isBusy", { timeout: 20000 });
                    await page.waitFor(() => window.foreverQuest.game.world.isSettled, { timeout: 20000 });
                };
                const setField = (key, value) => page.evaluate(([name, number]) =>
                {
                    const input = document.querySelector(".editor-palette [data-key=" + name + "]");

                    input.value = number;
                    input.dispatchEvent(new Event("change"));
                }, [key, value]);

                await page.click("[data-action=mode-brush]");
                await setField("radius", 2);
                await page.click("[data-action=brush-clean]");
                await page.click(".editor-palette [data-id=sand]");
                await stroke(1);

                const painted = await page.evaluate(([x, , z]) =>
                {
                    const zone = window.foreverQuest.game.zone;

                    return zone.blocks.block(zone.blockAt(x, zone.grounds[z * zone.columns + x] - 1, z)).id;
                }, column);

                await page.click("[data-action=brush-age]");
                await setField("age", 100);
                await setField("strength", 100);

                const youngAge = await page.evaluate(([x, , z]) => window.foreverQuest.game.zone.age(x, z), column);

                await stroke(2);

                const oldAge = await page.evaluate(([x, , z]) => window.foreverQuest.game.zone.age(x, z), column);
                const before = await ground();

                await page.click("[data-action=brush-sculpt]");
                await page.click("[data-action=brush-square]");
                await stroke(3);
                await screenshot("brushed");

                const view = await page.evaluate(() => window.foreverQuest.game.editMode.fly.yaw);

                await page.mouseDrag(640, 400, 700, 400, { button: "right" });

                assert.equal(painted, "sand");
                assert.ok(oldAge > youngAge, "The age went from " + youngAge + " to " + oldAge);
                assert.ok(await ground() > before, "The sculpt did not raise the ground");
                assert.notEqual(await page.evaluate(() => window.foreverQuest.game.editMode.fly.yaw), view, "A right-drag did not look around");
            }
            finally
            {
                await discard(page);
            }
        },
    },
    {
        name: "The Blocks palette shows one type, one pack or the recent blocks, and the Select palette's objects show one type",
        run: async ({ page, baseUrl }) =>
        {
            await openEditor(page, baseUrl);

            const shown = () => page.evaluate(() => [...document.querySelectorAll(".editor-palette [data-id]")].map((entry) => entry.title));
            const choose = (key, value) => page.evaluate(([name, choice]) =>
            {
                const select = document.querySelector(".editor-palette select[data-key=" + name + "]");

                select.value = choice;
                select.dispatchEvent(new Event("change"));
            }, [key, value]);

            await choose("type", "metal");

            const metal = await shown();

            await page.click(".editor-palette [title=steel]");
            await choose("type", "recent");

            const recent = await shown();

            await choose("type", "all");
            await choose("pack", "hearthmere");

            const kit = await shown();

            await page.click("[data-action=mode-select]");
            await choose("type", "lighting");

            const lighting = await shown();

            assert.deepEqual(metal, ["iron", "steel"]);
            assert.deepEqual(recent, ["steel"]);
            assert.deepEqual(kit, []);
            assert.ok(lighting.includes("candlestick") && !lighting.includes("bed"), "Lighting showed " + lighting.join(", "));
        },
    },
    {
        name: "Capture in Select mode takes a footprint on the ground from two clicked corners, then a top that follows the pointer up until a click, Page Up raises it a cube, and Cancel puts the box away; a prefab chosen to add shows its whole size at the pointer",
        run: async ({ page, baseUrl }) =>
        {
            await openEditor(page, baseUrl);
            await page.click("[data-action=mode-select]");
            await page.click("[data-action=capture]");

            const ground = await page.evaluate(() => window.foreverQuest.game.editMode.pickCell(600, 500).cell[1]);

            await page.clickAt(600, 500);
            await page.clickAt(680, 440);

            const flat = await page.evaluate(() => [...window.foreverQuest.game.editMode.tools.select.capturing.box]);

            await page.mouseMove(640, 200);
            await page.waitFor(() => window.foreverQuest.game.editMode.tools.select.capturing.box[4] > window.foreverQuest.game.editMode.tools.select.capturing.box[1] + 3);
            await page.clickAt(640, 200);
            await page.waitFor(() => !document.querySelector(".editor-card").hidden);

            const sizeOf = () => page.evaluate(() => document.querySelector(".editor-card h3").textContent.match(/(\d+) × (\d+) × (\d+)/).slice(1).map(Number));
            const [before, box] = [await sizeOf(), await page.evaluate(() => window.foreverQuest.game.editMode.tools.select.capturing.box)];

            await page.press("PageUp");

            const after = await sizeOf();

            await page.click("[data-action=capture-cancel]");

            const closed = await page.evaluate(() => ({ isHidden: document.querySelector(".editor-card").hidden, capturing: window.foreverQuest.game.editMode.tools.select.capturing }));

            assert.deepEqual([box[0], box[1], box[2], box[3], box[5]], [flat[0], flat[1], flat[2], flat[3], flat[5]], "Raising the top moved the footprint");
            assert.deepEqual(before, [box[3] - box[0] + 1, box[4] - box[1] + 1, box[5] - box[2] + 1]);
            assert.deepEqual(after, [before[0], before[1] + 1, before[2]]);
            assert.deepEqual(closed, { isHidden: true, capturing: null });
            assert.equal(flat[1], ground + 1, "The capture box takes in the ground");

            await page.evaluate(() =>
            {
                const select = window.foreverQuest.game.editMode.tools.select;

                select.setTab("prefabs");
                select.choose("well");
            });
            await page.mouseMove(640, 470);
            await page.waitFor(() => window.foreverQuest.game.editMode.marks.ghost.visible);

            const ghost = await page.evaluate(() => window.foreverQuest.game.editMode.marks.ghost.scale.toArray());

            assert.ok(ghost[0] > 1 && ghost[2] > 1, "The well's ghost is " + ghost.join(" × ") + " m, not its size");
        },
    },
    {
        name: "the bench opens an object large, adds a fine cube and its mirror, undoes, marks a light cell, slices, and asks before leaving with changes not saved",
        run: async ({ page, baseUrl, screenshot }) =>
        {
            await page.goto(baseUrl + "/index.html?zone=testfield&edit&view=" + VIEW + "&bench=barrel");
            await page.waitFor(() => window.foreverQuest?.isReady === true && window.foreverQuest.game?.editMode.bench?.isOpen, { timeout: 30000 });

            const count = () => page.evaluate(() => window.foreverQuest.game.editMode.bench.grid.data.filter((value) => value > 0).length);
            const before = await count();

            await page.clickAt(640, 400);

            const added = await count();

            await page.click("[data-action=bench-undo]");

            const undone = await count();

            await page.click("[data-action=bench-mirror]");
            await page.clickAt(640, 400);
            await screenshot("bench");

            const mirrored = await count();
            const data = await page.evaluate(() => window.foreverQuest.game.editMode.bench.data());
            const filled = data.runs.reduce((sum, value, i) => sum + (i % 2 === 1 ? value : 0), 0);
            await page.click("[data-action=bench-light]");
            await page.clickAt(640, 400);

            const lights = await page.evaluate(() => window.foreverQuest.game.editMode.bench.data().lights);
            const sliced = await page.evaluate(() =>
            {
                const bench = window.foreverQuest.game.editMode.bench;

                bench.setSlice(4);

                return bench.hitAt(640, 400)?.cell ?? null;
            });

            await page.click("[data-action=bench-back]");
            await page.waitFor(() => !document.querySelector(".editor-card").hidden);
            await page.click("[data-action=bench-discard]");

            const closed = await page.evaluate(() => ({ isOpen: window.foreverQuest.game.editMode.bench.isOpen, scene: window.foreverQuest.game.editMode.scene }));

            assert.deepEqual([added - before, undone - before, mirrored - before], [1, 0, 2]);
            assert.deepEqual([data.palette[0], filled, data.cells], [null, 16 * 24 * 16, [2, 3, 2]]);
            assert.ok(sliced === null || sliced[1] < 4, "A fine cube above the slice was picked: " + sliced);
            assert.deepEqual(closed, { isOpen: false, scene: null });
            assert.equal(lights?.length, 1, "The light tool did not mark a cell");
        },
    },
    {
        name: "a selected lever shows lines to its movers, a mover's move time changes in the inspector, Play runs the mover out and home, and Link movers unlinks a mover clicked",
        run: async ({ page, baseUrl, screenshot }) =>
        {
            await page.goto(baseUrl + "/index.html?zone=testfield&edit&view=-5,3.5,9,0,0.35");
            await page.waitFor(() => window.foreverQuest?.isReady === true && window.foreverQuest.game?.editMode.isActive, { timeout: 30000 });
            await page.waitFor(() => window.foreverQuest.game.world.isSettled, { timeout: 30000 });

            const middleOf = async (object) =>
            {
                const box = await page.evaluate((name) => window.foreverQuest.game.zone.objects.find((entry) => entry.object === name).box, object);

                return screenPoint(page, [(box[0] + box[3]) >> 1, (box[1] + box[4]) >> 1, box[5]]);
            };
            const settled = (steps) => page.waitFor("window.foreverQuest.game.editMode.state.steps === " + steps + " && !window.foreverQuest.game.editMode.isBusy", { timeout: 20000 });

            try
            {
                await page.press("2");
                await page.clickAt(...(await middleOf("leverBase")));
                await page.waitFor(() => window.foreverQuest.game.editMode.tools.select.entry?.object === "leverBase", { timeout: 20000 });
                await screenshot("lever-links");

                const lines = await page.evaluate(() => window.foreverQuest.game.editMode.marks.links.geometry.getAttribute("position").count);

                await page.clickAt(...(await middleOf("portcullis")));
                await page.waitFor(() => window.foreverQuest.game.editMode.tools.select.entry?.object === "portcullis", { timeout: 20000 });
                await page.evaluate(() =>
                {
                    const input = document.querySelector(".editor-inspector [data-key=seconds]");

                    input.value = "1";
                    input.dispatchEvent(new Event("change"));
                });
                await settled(1);

                const seconds = await page.evaluate(() => window.foreverQuest.game.sim.movers.mover("gate").track.seconds);

                await page.click("[data-action=play-movers]");
                await page.waitFor(() => window.foreverQuest.game.sim.movers.mover("gate").progress === 1, { timeout: 20000 });
                await page.waitFor(() => !window.foreverQuest.game.editMode.rehearsal.isPlaying, { timeout: 20000 });

                const home = await page.evaluate(() => window.foreverQuest.game.sim.movers.mover("gate").progress);

                await page.clickAt(...(await middleOf("leverBase")));
                await page.waitFor(() => window.foreverQuest.game.editMode.tools.select.entry?.object === "leverBase", { timeout: 20000 });
                await page.click("[data-action=link-movers]");
                await page.clickAt(...(await middleOf("portcullis")));
                await settled(2);

                const linked = await page.evaluate(() => ({ movers: window.foreverQuest.game.editMode.tools.select.entry.trigger.movers, selected: window.foreverQuest.game.editMode.tools.select.entry.object }));

                assert.equal(lines, 4, "The lever's lines do not run to its two movers");
                assert.deepEqual([seconds, home], [1, 0]);
                assert.deepEqual(linked, { movers: ["gateLever"], selected: "leverBase" });
            }
            finally
            {
                await discard(page);
            }
        },
    },
    {
        name: "T switches to day and L colours the faces by light level, the sky's by day and the lamps' by night, with a legend, until the editor closes",
        run: async ({ page, baseUrl, screenshot }) =>
        {
            await page.goto(baseUrl + "/index.html?zone=testfield&edit&view=4,6,11,0,1.4");
            await page.waitFor(() => window.foreverQuest?.isReady === true && window.foreverQuest.game?.editMode.isActive, { timeout: 30000 });
            await page.waitFor(() => window.foreverQuest.game.world.isSettled, { timeout: 30000 });

            const brightness = () => page.evaluate(() =>
            {
                const app = window.foreverQuest;
                const gl = app.renderer.webgl.getContext();
                const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
                let sum = 0;

                app.game.render(app.renderer.webgl);
                gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

                for(let i = 0; i < pixels.length; i += 4) { sum += pixels[i] * 0.2126 + pixels[i + 1] * 0.7152 + pixels[i + 2] * 0.0722; }

                return sum / (pixels.length / 4) / 255;
            });
            const shown = () => page.evaluate(() => ({ levels: window.foreverQuest.materials.stepped.lightLevels.value, legend: document.querySelector(".editor-legend").hidden ? null : document.querySelector(".editor-legend b").textContent }));

            await page.press("t");

            const day = await brightness();

            await page.press("l");
            await screenshot("light-levels-day");

            const dayLevels = await brightness();
            const dayShown = await shown();

            await page.press("t");

            const nightLevels = await brightness();
            const nightShown = await shown();

            await screenshot("light-levels-night");

            await page.press("F8");

            const closed = await page.evaluate(() => window.foreverQuest.materials.stepped.lightLevels.value);

            assert.ok(dayLevels > day + 0.15, "Open ground by day is not drawn at sky level 15: " + dayLevels + " against " + day);
            assert.ok(nightLevels < 0.1, "Open ground with no lamp near is not drawn at lamp level 0: " + nightLevels);
            assert.deepEqual([dayShown, nightShown, closed], [{ levels: 2, legend: "Sky or lamp level" }, { levels: 1, legend: "Lamp level" }, 0]);
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
