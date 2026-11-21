import * as Server from "../serve.js";
import * as childProcess from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { Browser } from "../../js-tests/browser/cdp.js";
import { Log } from "../../js/log.js";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const SCREENS = path.join(ROOT, "local", "screens");
const BAKE = path.join(ROOT, "tools", "bake", "bake.js");
const FRAMES = 6;
const USAGE = "Usage: node tools/workbench/capture.js <name> [query]\n"
    + "Example: node tools/workbench/capture.js wolf \"body=wolf&overlay=bones\"";

async function capture(name, query)
{
    const server = await Server.startServer({ root: ROOT, port: 0 });
    let browser = null;

    try
    {
        browser = await Browser.launch({ headless: true });

        const page = await browser.newPage();
        const target = path.join(SCREENS, "workbench-" + name.replace(/[^\w.-]+/g, "-") + ".png");

        await page.goto(server.url + "/tools/workbench/index.html?" + query);
        await page.waitFor(() => window.workbench?.isReady === true, { timeout: 20000 });

        const start = await page.evaluate(() => window.workbench.renderer.frameCount);

        await page.waitFor("window.workbench.renderer.frameCount > " + (start + FRAMES), { timeout: 20000 });
        fs.mkdirSync(SCREENS, { recursive: true });
        await page.screenshot(target);

        if(page.errors.length > 0) { throw new Error("The workbench reported errors:\n" + page.errors.join("\n")); }

        return target;
    }
    finally
    {
        await browser?.close();
        await server.close();
    }
}

async function main()
{
    const [name, query = ""] = process.argv.slice(2);

    if(!name)
    {
        Log.error(USAGE);
        process.exitCode = 1;
        return;
    }

    if(childProcess.spawnSync(process.execPath, [BAKE], { stdio: "inherit" }).status !== 0)
    {
        process.exitCode = 1;
        return;
    }

    try
    {
        Log.info("Saved " + await capture(name, query));
    }
    catch(error)
    {
        Log.error("The capture failed.", error);
        process.exitCode = 1;
    }
}

await main();
