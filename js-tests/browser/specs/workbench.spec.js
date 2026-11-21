import * as assert from "node:assert/strict";

export const covers = ["workbench"];

async function openViewer(page, baseUrl, query = "")
{
    await page.goto(baseUrl + "/tools/workbench/index.html?" + query);
    await page.waitFor(() => window.workbench?.isReady === true && window.workbench.renderer.frameCount > 2, { timeout: 20000 });
}

function viewed()
{
    const viewer = window.workbench.viewer;
    const plan = viewer.model.plan;

    return {
        body: viewer.appearance.get("body"),
        rig: plan.rig.id,
        bones: plan.fit.bones.map((bone) => bone.name),
        height: plan.height,
        overlay: viewer.overlay.length,
        query: location.search,
        hasMotions: document.querySelector("[data-key=motion]") !== null,
        hasWave: [...document.querySelectorAll(".workbench-panel button")].some((button) => button.textContent === "Wave"),
    };
}

export const tests =
[
    {
        name: "the model viewer shows a creature on its own rig, from the address alone",
        run: async ({ page, baseUrl, screenshot }) =>
        {
            await openViewer(page, baseUrl, "body=wolf&overlay=bones");

            const wolf = await page.evaluate(viewed);

            assert.equal(wolf.body, "wolf");
            assert.equal(wolf.rig, "quadruped");
            assert.ok(wolf.bones.includes("tail") && wolf.bones.includes("legBR"), wolf.bones.join());
            assert.ok(wolf.overlay >= wolf.bones.length * 2 - 1, wolf.overlay + " overlay objects");
            assert.equal(wolf.hasMotions, true);
            assert.equal(wolf.hasWave, false);
            await screenshot("wolf");
        },
    },
    {
        name: "stepping the body switches rigs, and the address keeps the view",
        run: async ({ page, baseUrl }) =>
        {
            await openViewer(page, baseUrl, "body=orc");
            await page.click("[aria-label='Next Body']");

            const ogre = await page.evaluate(viewed);

            assert.equal(ogre.body, "ogre");
            assert.equal(ogre.rig, "humanoid");
            assert.ok(ogre.height > 2.1, "The ogre is " + ogre.height + " metres tall");
            assert.equal(ogre.hasMotions, true);
            assert.equal(ogre.hasWave, true);

            await page.click("[aria-label='Next Body']");

            const wolf = await page.evaluate(viewed);

            assert.equal(wolf.rig, "quadruped");
            assert.match(wolf.query, /body=wolf/);
            assert.equal(wolf.overlay, 0);
        },
    },
    {
        name: "the prop viewer shows a prefab with its colliders and lights, and steps to the next",
        run: async ({ page, baseUrl }) =>
        {
            await openViewer(page, baseUrl, "view=props&prefab=lampPost&overlay=1");

            const lamp = await page.evaluate(() =>
            {
                const viewer = window.workbench.viewer;

                return { prefab: viewer.prefabId, overlay: viewer.overlay.children.length, triangles: viewer.mesh.geometry.getAttribute("position").count / 3 };
            });

            assert.equal(lamp.prefab, "lampPost");
            assert.equal(lamp.overlay, 2);
            assert.ok(lamp.triangles > 0);

            await page.click("[aria-label='Next Prefab']");

            assert.notEqual(await page.evaluate(() => window.workbench.viewer.prefabId), "lampPost");
            assert.match(await page.evaluate(() => location.search), /view=props/);
        },
    },
];
