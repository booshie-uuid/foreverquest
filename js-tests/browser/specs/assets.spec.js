import * as Capture from "../../reference/capture.js";
import * as TestAssets from "../../helpers/assets.js";
import * as assert from "node:assert/strict";

export const covers = ["assets"];

export const tests =
[
    {
        name: "the browser decodes the baked world textures to the same texels as Node",
        run: async ({ page, baseUrl }) =>
        {
            const expected = Capture.worldTexturesRecord(await TestAssets.atlas());

            await page.goto(baseUrl + "/index.html");
            await page.waitFor(() => window.foreverQuest?.isReady === true, { timeout: 20000 });

            const loaded = await page.evaluate(async () =>
            {
                const atlas = window.foreverQuest.materials.atlas;
                const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", atlas.upload));

                return {
                    layers: atlas.names,
                    upload: [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join(""),
                    isLoadingShown: document.querySelector(".loading") !== null,
                };
            });

            assert.deepEqual({ layers: loaded.layers, upload: loaded.upload }, expected);
            assert.equal(loaded.isLoadingShown, false);
        },
    },
];
