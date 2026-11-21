import * as Server from "../../tools/serve.js";
import * as childProcess from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";
import * as util from "node:util";

import { Browser } from "./cdp.js";
import { Log } from "../../js/log.js";

const PROJECT_ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..", "..");
const BAKE = path.join(PROJECT_ROOT, "tools", "bake", "bake.js");
const SPECS_DIR = path.join(PROJECT_ROOT, "js-tests", "browser", "specs");
const SCREENS_DIR = path.join(PROJECT_ROOT, "local", "screens");
const SPEC_SUFFIX = ".spec.js";
const TEST_TIMEOUT_MS = 60000;
const USAGE = "Usage: node js-tests/browser/run.js [--covers <tag>] [--headed] [--keep-screens]";


/******************************************************************************/
/* RUNNER                                                                     */
/******************************************************************************/

class Runner
{
    constructor(browser, baseUrl, shouldKeepScreens)
    {
        this.browser = browser;
        this.baseUrl = baseUrl;
        this.shouldKeepScreens = shouldKeepScreens;
        this.passed = 0;
        this.failed = 0;
    }

    async runSpec(spec)
    {
        for(const test of spec.tests) { await this.runTest(spec, test); }
    }

    async runTest(spec, test)
    {
        const startedAt = Date.now();
        const screens = [];

        let page = null;
        let thrownError = null;

        try
        {
            page = await this.browser.newPage();

            const screenshot = (name) =>
            {
                const filePath = Runner.screenPath(spec.name, name);

                screens.push(filePath);

                return page.screenshot(filePath);
            };

            await Runner.withTimeout(test.run({ page, baseUrl: this.baseUrl, screenshot }), test.timeout ?? TEST_TIMEOUT_MS);
        }
        catch(error)
        {
            thrownError = error;
        }

        const failure = Runner.describeFailure(thrownError, page);

        await this.finishPage(page, spec, test, failure, screens);
        this.record(spec, test, failure, Date.now() - startedAt);
    }

    async finishPage(page, spec, test, failure, screens)
    {
        if(!page) { return; }

        if(failure)
        {
            await Runner.tryAction("save the failure screenshot", () => page.screenshot(Runner.screenPath(spec.name, test.name + " failure")));
        }
        else if(!this.shouldKeepScreens)
        {
            for(const filePath of screens) { await Runner.tryAction("remove " + filePath, () => fs.promises.rm(filePath, { force: true })); }
        }

        await Runner.tryAction("close the page", () => page.close());
    }

    record(spec, test, failure, durationMs)
    {
        const label = spec.name + " > " + test.name + " (" + durationMs + " ms)";

        if(!failure)
        {
            this.passed++;
            Log.info("PASS  " + label);
            return;
        }

        this.failed++;
        Log.info("FAIL  " + label);
        Log.info(Runner.indent(failure));
    }

    static describeFailure(thrownError, page)
    {
        const parts = [];

        if(thrownError)
        {
            const stack = thrownError.stack ?? String(thrownError);
            const specLines = stack.split("\n").filter((line) => !line.includes(import.meta.url));

            parts.push(specLines.join("\n"));
        }

        if(page?.errors.length > 0) { parts.push("The page reported errors:\n" + page.errors.join("\n")); }

        return parts.length > 0 ? parts.join("\n") : null;
    }

    static withTimeout(promise, timeoutMs)
    {
        let timer;

        const timeout = new Promise((resolve, reject) =>
        {
            timer = setTimeout(() => reject(new Error("The test did not finish within " + timeoutMs + " ms.")), timeoutMs);
        });

        return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
    }

    static async tryAction(description, action)
    {
        try
        {
            await action();
        }
        catch(error)
        {
            Log.warn("Could not " + description + ".", error);
        }
    }

    static screenPath(specName, name)
    {
        const fileName = (specName + "-" + name).replace(/[^\w.-]+/g, "-");

        return path.join(SCREENS_DIR, fileName + ".png");
    }

    static indent(text)
    {
        return text.split("\n").map((line) => "      " + line).join("\n");
    }
}


/******************************************************************************/
/* SPECS                                                                      */
/******************************************************************************/

async function loadSpecs(tag)
{
    const files = (await fs.promises.readdir(SPECS_DIR)).filter((file) => file.endsWith(SPEC_SUFFIX)).sort();
    const specs = [];

    for(const file of files)
    {
        const spec = await loadSpec(file);

        if(!tag || spec.covers.includes(tag)) { specs.push(spec); }
    }

    return specs;
}

async function loadSpec(file)
{
    const specModule = await import(url.pathToFileURL(path.join(SPECS_DIR, file)).href);
    const isValid = Array.isArray(specModule.covers)
        && Array.isArray(specModule.tests)
        && specModule.tests.every((test) => typeof test.name === "string" && typeof test.run === "function");

    if(!isValid) { throw new Error(file + " must export a covers array and a tests array of { name, run }."); }

    return { name: file.slice(0, -SPEC_SUFFIX.length), covers: specModule.covers, tests: specModule.tests };
}


/******************************************************************************/
/* COMMAND LINE                                                               */
/******************************************************************************/

function readOptions()
{
    try
    {
        const { values } = util.parseArgs(
        {
            options:
            {
                "covers": { type: "string" },
                "headed": { type: "boolean", default: false },
                "keep-screens": { type: "boolean", default: false },
            },
        });

        return { tag: values.covers, isHeaded: values.headed, shouldKeepScreens: values["keep-screens"] };
    }
    catch(error)
    {
        Log.error(error.message + "\n" + USAGE);

        return null;
    }
}

async function runSpecs(specs, options)
{
    const server = await Server.startServer({ root: PROJECT_ROOT, port: 0 });

    let browser = null;

    try
    {
        browser = await Browser.launch({ headless: !options.isHeaded });

        const runner = new Runner(browser, server.url, options.shouldKeepScreens);
        const startedAt = Date.now();

        for(const spec of specs) { await runner.runSpec(spec); }

        Log.info("\n" + runner.passed + " passed, " + runner.failed + " failed (" + (Date.now() - startedAt) + " ms)");

        return runner.failed === 0;
    }
    finally
    {
        await browser?.close();
        await server.close();
    }
}

async function main()
{
    try
    {
        const options = readOptions();

        if(!options)
        {
            process.exitCode = 1;
            return;
        }

        const bake = childProcess.spawnSync(process.execPath, [BAKE], { stdio: "inherit" });

        if(bake.status !== 0)
        {
            process.exitCode = 1;
            return;
        }

        const specs = await loadSpecs(options.tag);

        if(specs.length === 0)
        {
            Log.error(options.tag ? "No spec covers \"" + options.tag + "\"." : "No specs found in " + SPECS_DIR + ".");
            process.exitCode = 1;
            return;
        }

        const isSuccess = await runSpecs(specs, options);

        if(!isSuccess) { process.exitCode = 1; }
    }
    catch(error)
    {
        Log.error("The browser test run failed.", error);
        process.exitCode = 1;
    }
}

// Node skips "exit" listeners, such as the one that kills the browser, when a signal ends the process.
process.once("SIGINT", () => process.exit(130));

await main();
