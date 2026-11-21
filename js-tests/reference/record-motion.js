import * as Motion from "./motion.js";
import * as TestAssets from "../helpers/assets.js";
import * as fs from "node:fs";
import * as path from "node:path";
import { Log } from "../../js/log.js";

const OUTPUT = path.join(import.meta.dirname, "prototype-motion.json");

// The motion reference describes the prototype's procedural animator, so it
// is recorded once, before clips replace it.
async function main()
{
    if(fs.existsSync(OUTPUT))
    {
        Log.error(OUTPUT + " exists. The motion reference is recorded once from the prototype animator.");
        process.exitCode = 1;
        return;
    }

    const library = await TestAssets.library();
    const cases = Motion.CASES.map((entry) => ({ label: entry.label, samples: Motion.sample(library, entry, Motion.prototype) }));

    fs.writeFileSync(OUTPUT, JSON.stringify(cases) + "\n");
    Log.info("Recorded " + cases.length + " motion cases to " + OUTPUT);
}

await main();
