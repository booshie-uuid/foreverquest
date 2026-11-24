import * as RegionCodec from "../js/sim/region-codec.js";
import * as Terrain from "./bake/terrain.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";
import { Log } from "../js/log.js";

const USAGE = "Usage: node tools/region-text.js <region .bin file>";


/******************************************************************************/
/* TEXT                                                                       */
/******************************************************************************/

// One line for the region, then one per chunk: its position and its cells as
// runs of "count block", in (y * size + z) * size + x order. `names` maps a
// block number to its id.
export function text(region, names)
{
    const name = (block) => (block === 0 ? "air" : names[block] ?? "block " + block);
    const lines = ["region " + region.width + " × " + region.depth + " columns, " + region.height + " cells high, " + region.chunks.length + " chunks"];

    for(const chunk of region.chunks)
    {
        const at = "chunk " + chunk.x + " " + chunk.y + " " + chunk.z + ": ";

        if(chunk.cells === null)
        {
            lines.push(at + "all " + name(chunk.uniform));
            continue;
        }

        const runs = [];
        let start = 0;

        for(let i = 1; i <= chunk.cells.length; i++)
        {
            if(i === chunk.cells.length || chunk.cells[i] !== chunk.cells[start])
            {
                runs.push((i - start) + " " + name(chunk.cells[start]));
                start = i;
            }
        }

        lines.push(at + runs.join(", "));
    }

    return lines.join("\n") + "\n";
}

// A locked region names its blocks from the palette beside it; a baked one
// from the baked blocks list.
function namesFor(file)
{
    const palette = path.join(path.dirname(file), Terrain.PALETTE_FILE);
    const baked = path.resolve(import.meta.dirname, "..", "assets", "blocks.json");
    const ids = fs.existsSync(palette) ? JSON.parse(fs.readFileSync(palette, "utf8")) : JSON.parse(fs.readFileSync(baked, "utf8")).map((block) => block.id);

    return [null, ...ids];
}


/******************************************************************************/
/* COMMAND LINE                                                               */
/******************************************************************************/

function main()
{
    const file = process.argv[2];

    if(!file)
    {
        Log.error(USAGE);
        process.exitCode = 1;
        return;
    }

    try
    {
        const region = RegionCodec.decode(new Uint8Array(zlib.inflateSync(fs.readFileSync(file))));

        process.stdout.write(text(region, namesFor(path.resolve(file))));
    }
    catch(error)
    {
        Log.error("Could not read the region " + file + ".", error);
        process.exitCode = 1;
    }
}

if(import.meta.main) { main(); }
