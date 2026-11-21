import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

import { Log } from "../js/log.js";

const PROJECT_ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const SOURCE_DIR = path.join(PROJECT_ROOT, "node_modules", "three", "build");
const TARGET_DIR = path.join(PROJECT_ROOT, "libs", "three");

// three.module.js imports ./three.core.js.
const FILES = ["three.module.js", "three.core.js"];

try
{
    await fs.promises.mkdir(TARGET_DIR, { recursive: true });

    for(const file of FILES)
    {
        await fs.promises.copyFile(path.join(SOURCE_DIR, file), path.join(TARGET_DIR, file));
        Log.info("Copied " + file + " to " + path.relative(PROJECT_ROOT, TARGET_DIR));
    }
}
catch(error)
{
    Log.error("Could not copy three.js into libs/three. Run npm install first.", error);
    process.exitCode = 1;
}
