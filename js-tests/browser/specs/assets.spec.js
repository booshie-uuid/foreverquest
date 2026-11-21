import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

export const covers = ["assets"];

const REFERENCE = path.resolve(import.meta.dirname, "..", "..", "reference", "prototype.json");

export const tests =
[
    {
        name: "the browser decodes the baked world textures to the prototype's texels",
        run: async ({ page, baseUrl }) =>
        {
            const expected = JSON.parse(fs.readFileSync(REFERENCE, "utf8")).worldTextures;

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
