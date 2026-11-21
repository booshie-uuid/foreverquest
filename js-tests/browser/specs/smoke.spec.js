import * as assert from "node:assert/strict";

export const covers = ["boot"];

export const tests =
[
    {
        name: "boots the game and renders the canvas",
        run: async ({ page, baseUrl, screenshot }) =>
        {
            await page.goto(baseUrl + "/index.html");
            await page.waitFor(() => window.foreverQuest?.isReady === true, { timeout: 20000 });

            const size = await page.evaluate(() =>
            {
                const canvas = document.querySelector("canvas");

                if(!canvas) { return null; }

                return { width: canvas.width, height: canvas.height, clientWidth: canvas.clientWidth, clientHeight: canvas.clientHeight };
            });

            assert.ok(size, "The page has no <canvas>.");
            assert.ok(Object.values(size).every((value) => value > 0), "The canvas has a zero size: " + JSON.stringify(size));

            await screenshot("boot");
        },
    },
];
