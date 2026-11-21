import * as Capture from "./capture.js";
import * as TestAssets from "../helpers/assets.js";
import * as fs from "node:fs";
import * as path from "node:path";
import { Log } from "../../js/log.js";

const OUTPUT = path.join(import.meta.dirname, "prototype.json");

// The reference describes the prototype, so it is recorded once, before the
// restructure changes the code it captures.
async function main()
{
    if(fs.existsSync(OUTPUT) && !process.argv.includes("--overwrite"))
    {
        Log.error(OUTPUT + " exists. The reference is recorded once from the prototype; pass --overwrite only to re-record from the prototype commit.");
        process.exitCode = 1;
        return;
    }

    const materials = await TestAssets.materials();
    const library = await TestAssets.library();
    const characters = Capture.appearanceInputs(library).map(({ label, look }) => ({ label, look, record: Capture.characterRecord(library, look) }));
    const reference =
    {
        characters,
        parts: Capture.partSweep(library),
        worldTextures: Capture.worldTexturesRecord(materials.atlas),
        zone: Capture.zoneRecord(await TestAssets.zone("hearthmere")),
    };

    fs.writeFileSync(OUTPUT, JSON.stringify(reference) + "\n");
    Log.info("Recorded " + characters.length + " characters, " + Object.keys(reference.parts).length + " part cases and the zone to " + OUTPUT);
}

await main();
