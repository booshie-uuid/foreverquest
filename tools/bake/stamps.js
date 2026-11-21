import * as Compositor from "../../js/kit/compositor.js";
import * as PngWriter from "./png-writer.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";
import { Random } from "../../js/util/random.js";
import { Raster } from "../../js/engine/raster.js";

const FOLDER = path.resolve(import.meta.dirname, "..", "..", "content", "stamps");
const SHEET_WIDTH = 256;
const ID_PATTERN = /^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9]+)*$/;
const UNTOUCHED = 7;
const GREY = Compositor.GREY;
const PROBE = [200, 60, 130, 255];
const PREVIEW_TINT = 150;

export async function bake(problems, context)
{
    const stamps = await load(problems);
    const placed = pack(stamps);
    const height = Math.ceil(placed.height / 16) * 16;
    const sheet = new Raster(SHEET_WIDTH, height);
    const index = { size: [SHEET_WIDTH, height], stamps: {} };

    for(const stamp of stamps)
    {
        const [x, y] = placed.at.get(stamp.id);
        const texels = encode(stamp, problems);

        for(let row = 0; row < stamp.size[1]; row++)
        {
            sheet.data.set(texels.subarray(row * stamp.size[0] * 4, (row + 1) * stamp.size[0] * 4), ((y + row) * SHEET_WIDTH + x) * 4);
        }

        index.stamps[stamp.id] = { rect: [x, y, ...stamp.size], isTinted: texels.some((value, i) => i % 4 === 3 && value === Compositor.TINTED) };
    }

    context.stamps = index.stamps;

    return {
        files:
        [
            { path: "models/stamps.png", bytes: PngWriter.encode(SHEET_WIDTH, height, sheet.data) },
            { path: "models/stamps.preview.png", bytes: PngWriter.encode(SHEET_WIDTH, height, preview(sheet.data)) },
            { path: "models/stamps.json", bytes: Buffer.from(JSON.stringify(index, null, 4) + "\n") },
        ],
        ids: { stamp: stamps.map((stamp) => stamp.id) },
    };
}

// Shows tinted texels in grey and cut-outs in magenta, for looking at only.
function preview(data)
{
    const out = new Uint8Array(data.length);

    for(let i = 0; i < data.length; i += 4)
    {
        const kind = data[i + 3];
        const shade = Math.min(255, Math.round(PREVIEW_TINT * data[i] / GREY));

        if(kind === Compositor.TINTED) { out.set([shade, shade, shade, 255], i); }
        else if(kind === Compositor.CLEAR) { out.set([255, 0, 255, 255], i); }
        else if(kind !== Compositor.SKIP) { out.set([data[i], data[i + 1], data[i + 2], 255], i); }
    }

    return out;
}

async function load(problems)
{
    const stamps = [];
    const seeds = new Map();

    for(const file of fs.readdirSync(FOLDER).filter((name) => name.endsWith(".js")).sort())
    {
        const loaded = await import(url.pathToFileURL(path.join(FOLDER, file)).href);

        for(const [id, stamp] of Object.entries(loaded.STAMPS ?? {}))
        {
            const where = "Stamp " + id + " in stamps/" + file;
            const [width, height] = stamp.size ?? [];

            if(!ID_PATTERN.test(id) || stamps.some((entry) => entry.id === id)) { problems.push(where + " has an invalid or repeated id"); continue; }
            if(!(Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0 && width <= SHEET_WIDTH)) { problems.push(where + " needs a whole-number size up to " + SHEET_WIDTH + " wide"); continue; }
            if(!Number.isInteger(stamp.seed) || seeds.has(stamp.seed)) { problems.push(where + " needs a whole-number seed that no other stamp uses"); continue; }

            seeds.set(stamp.seed, id);
            stamps.push({ id, ...stamp });
        }
    }

    return stamps;
}

function pack(stamps)
{
    const at = new Map();
    let x = 0;
    let y = 0;
    let shelf = 0;

    for(const stamp of [...stamps].sort((a, b) => b.size[1] - a.size[1] || a.id.localeCompare(b.id)))
    {
        if(x + stamp.size[0] > SHEET_WIDTH)
        {
            y += shelf;
            x = 0;
            shelf = 0;
        }

        at.set(stamp.id, [x, y]);
        x += stamp.size[0];
        shelf = Math.max(shelf, stamp.size[1]);
    }

    return { at, height: y + shelf };
}

// Paints the stamp twice with the same seed: once in grey and once in a probe
// colour. Texels that change are tinted; texels that do not are fixed.
function encode(stamp, problems)
{
    const [width, height] = stamp.size;
    const grey = paint(stamp, [GREY, GREY, GREY, 255]);
    const probe = paint(stamp, PROBE);
    const texels = new Uint8Array(width * height * 4);

    for(let i = 0; i < texels.length; i += 4)
    {
        const alpha = grey.data[i + 3];
        const isSame = [0, 1, 2].every((channel) => grey.data[i + channel] === probe.data[i + channel]);

        if(alpha === UNTOUCHED) { continue; }

        if(alpha === 0)
        {
            texels[i + 3] = Compositor.CLEAR;
        }
        else if(isSame)
        {
            texels.set([grey.data[i], grey.data[i + 1], grey.data[i + 2], stamp.glow ? Compositor.GLOWING : Compositor.FIXED], i);
        }
        else if(grey.data[i] === grey.data[i + 1] && grey.data[i] === grey.data[i + 2])
        {
            texels.set([grey.data[i], 0, 0, Compositor.TINTED], i);
        }
        else
        {
            problems.push("Stamp " + stamp.id + " mixes its tint with another colour at texel " + i / 4);
            break;
        }
    }

    return texels;
}

function paint(stamp, colour)
{
    const [width, height] = stamp.size;
    const raster = new Raster(width, height);

    for(let i = 3; i < raster.data.length; i += 4) { raster.data[i] = UNTOUCHED; }

    stamp.paint(raster, { x: 0, y: 0, w: width, h: height }, new Random(stamp.seed), colour);

    return raster;
}
