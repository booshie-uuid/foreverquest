import * as assert from "node:assert/strict";

export const covers = ["creator"];

async function openCreator(page, baseUrl)
{
    await page.goto(baseUrl + "/index.html");
    await page.waitFor(() => window.foreverQuest?.isReady === true && window.foreverQuest.renderer.frameCount > 2, { timeout: 20000 });
}

function draft()
{
    return window.foreverQuest.creator.draft.toJSON();
}

export const tests =
[
    {
        name: "draws the preview character",
        run: async ({ page, baseUrl, screenshot }) =>
        {
            await openCreator(page, baseUrl);

            const coverage = await page.evaluate(() =>
            {
                const app = window.foreverQuest;
                const webgl = app.renderer.webgl;
                const gl = webgl.getContext();
                const width = gl.drawingBufferWidth;
                const height = gl.drawingBufferHeight;
                const pixels = new Uint8Array(width * height * 4);

                app.creator.render(webgl);
                gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

                const background = [pixels[0], pixels[1], pixels[2]];
                let changed = 0;

                for(let i = 0; i < pixels.length; i += 4)
                {
                    if(Math.abs(pixels[i] - background[0]) + Math.abs(pixels[i + 1] - background[1]) + Math.abs(pixels[i + 2] - background[2]) > 30) { changed++; }
                }

                return changed / (width * height);
            });

            assert.ok(coverage > 0.03, "Only " + (coverage * 100).toFixed(1) + "% of the canvas differs from the background.");
            await screenshot("preview");
        },
    },
    {
        name: "stepping the race rebuilds the character with the new proportions",
        run: async ({ page, baseUrl }) =>
        {
            await openCreator(page, baseUrl);

            const before = await page.evaluate(() => window.foreverQuest.creator.model.plan.height);

            await page.click("[aria-label='Next Race']");
            await page.click("[aria-label='Next Race']");

            const after = await page.evaluate(() =>
            {
                const creator = window.foreverQuest.creator;

                return {
                    body: creator.draft.get("body"),
                    height: creator.model.plan.height,
                    label: document.querySelector("[data-key=body] .stepper-value").textContent,
                };
            });

            assert.equal(after.body, "dwarf");
            assert.equal(after.label, "Dwarf");
            assert.ok(after.height < before * 0.8, "The dwarf is " + after.height + " tall, the human " + before);
        },
    },
    {
        name: "a skin swatch from the new race's palette applies after a race change",
        run: async ({ page, baseUrl }) =>
        {
            await openCreator(page, baseUrl);

            await page.click("[aria-label='Previous Race']");
            await page.click("[data-key=skin] .swatch:nth-child(1)");

            const look = await page.evaluate(draft);
            const swatch = await page.evaluate(() => document.querySelector("[data-key=skin] .swatch:nth-child(1)").dataset.colour);

            assert.equal(look.body, "orc");
            assert.equal(look.skin, swatch);
        },
    },
    {
        name: "the gear tab equips items and tints them",
        run: async ({ page, baseUrl, screenshot }) =>
        {
            await openCreator(page, baseUrl);

            await page.click("[data-tab=gear]");
            await page.click("[aria-label='Next Head']");
            await page.click("[data-key=tint-head] .swatch:nth-child(3)");

            const look = await page.evaluate(draft);
            const swatch = await page.evaluate(() => document.querySelector("[data-key=tint-head] .swatch:nth-child(3)").dataset.colour);

            assert.equal(look.equipment.head.item, "hood");
            assert.equal(look.equipment.head.colour, swatch);
            await screenshot("gear");
        },
    },
    {
        name: "stepping the markings repaints the character sheet",
        run: async ({ page, baseUrl, screenshot }) =>
        {
            await openCreator(page, baseUrl);

            const before = await page.evaluate(() => Array.from(window.foreverQuest.creator.model.textures.map.image.data));

            await page.click("[data-tab=head]");
            await page.click("[aria-label='Next Markings']");

            const after = await page.evaluate(() => (
            {
                markings: window.foreverQuest.creator.draft.get("markings"),
                label: document.querySelector("[data-key=markings] .stepper-value").textContent,
                data: Array.from(window.foreverQuest.creator.model.textures.map.image.data),
            }));
            const changed = after.data.filter((value, i) => value !== before[i]).length;

            assert.equal(after.markings, "scar");
            assert.equal(after.label, "Scar");
            assert.ok(changed > 8, changed + " texels changed");
            await page.evaluate(() => window.foreverQuest.creator.setView("face"));
            await screenshot("scar");
        },
    },
    {
        name: "randomise changes the look but keeps the name",
        run: async ({ page, baseUrl }) =>
        {
            await openCreator(page, baseUrl);

            const before = await page.evaluate(draft);

            await page.click("[data-action=randomise]");

            const after = await page.evaluate(draft);

            assert.equal(after.name, before.name);
            assert.notDeepEqual(after, before);
        },
    },
    {
        name: "an invalid name disables Enter World",
        run: async ({ page, baseUrl }) =>
        {
            await openCreator(page, baseUrl);

            const result = await page.evaluate(() =>
            {
                const input = document.querySelector("[data-key=name] input");

                input.value = "!!";
                input.dispatchEvent(new Event("input"));

                return {
                    isDisabled: document.querySelector("[data-action=confirm]").disabled,
                    name: window.foreverQuest.creator.draft.get("name"),
                };
            });

            assert.equal(result.isDisabled, true);
            assert.equal(result.name, "Adventurer");
        },
    },
];
