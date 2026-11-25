import * as Recipe from "../../tools/terrain/recipe.js";
import * as RegionCodec from "../../js/sim/region-codec.js";
import * as Server from "../../tools/serve.js";
import * as Terrain from "../../tools/bake/terrain.js";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as http from "node:http";
import * as os from "node:os";
import * as path from "node:path";
import * as zlib from "node:zlib";
import { describe, it } from "node:test";
import { EditSession } from "../../tools/editor/session.js";
import { EditorRoutes } from "../../tools/editor/routes.js";

const CONTENT = path.resolve(import.meta.dirname, "..", "..", "content");
const REGION = RegionCodec.REGION;
const CHUNK = RegionCodec.CHUNK;

// The block in a cell of the region file the session baked.
function bakedBlock(session, [x, y, z])
{
    const name = Math.floor(x / REGION) + "-" + Math.floor(z / REGION);
    const region = RegionCodec.decode(new Uint8Array(zlib.inflateSync(session.file(name + ".bin"))));
    const [cx, cy, cz] = [Math.floor((x % REGION) / CHUNK), Math.floor(y / CHUNK), Math.floor((z % REGION) / CHUNK)];
    const chunk = region.chunks.find((entry) => entry.x === cx && entry.y === cy && entry.z === cz);

    if(!chunk) { return 0; }

    return chunk.cells === null ? chunk.uniform : chunk.cells[((y % CHUNK) * CHUNK + (z % CHUNK)) * CHUNK + (x % CHUNK)];
}

// The age of a column in the region file the session baked.
function bakedAge(session, column, row)
{
    const name = Math.floor(column / REGION) + "-" + Math.floor(row / REGION);
    const region = RegionCodec.decode(new Uint8Array(zlib.inflateSync(session.file(name + ".bin"))));

    return region.ages[(row % REGION) * region.width + (column % REGION)];
}

// A terrain column in the open, with no placement over it.
function openCell(session)
{
    for(let x = 20; x < session.zone.columns; x += 7)
    {
        const z = 20;
        const y = session.terrain.surfaces[z * session.zone.columns + x];

        if(session.ownerOf(x, y, z) === null && session.ownerOf(x, y - 1, z) === null && session.blockAt(x, y, z) === 0) { return [x, y, z]; }
    }

    throw new Error("The zone has no open ground on row 20");
}

const hearthmere = await EditSession.open("hearthmere", CONTENT);

describe("Edit sessions", () =>
{
    it("places a cube on the terrain, refuses one that a building owns, and undoes and redoes the change", async () =>
    {
        const session = await EditSession.open("testfield", CONTENT);
        const cell = openCell(session);
        const cobble = session.numbers.cobble;
        const [x, y, z] = cell;
        const [key] = session.placed.owners.keys();
        const columns = session.zone.columns;
        const owned = [key % columns, Math.floor(key / (columns * columns)), Math.floor(key / columns) % columns];
        const answer = await session.apply([{ type: "cubes", cells: [[x, y, z, cobble], [...owned, cobble]] }]);

        assert.deepEqual(answer.regions, [Math.floor(x / REGION) + "-" + Math.floor(z / REGION)]);
        assert.equal(bakedBlock(session, cell), cobble);
        assert.equal(session.terrain.surfaces[z * session.zone.columns + x], y + 1, "The column's surface did not rise");
        assert.deepEqual([answer.isDirty, answer.canUndo, answer.canRedo], [true, true, false]);
        assert.deepEqual(answer.refused, [[...owned, session.ownerOf(...owned)]]);
        assert.notEqual(session.ownerOf(...owned), null);

        await session.undo();
        assert.equal(bakedBlock(session, cell), 0);
        assert.deepEqual([session.state.isDirty, session.state.canRedo], [false, true]);

        await session.redo();
        assert.equal(bakedBlock(session, cell), cobble);
    });

    it("names the placement that owns a cell, so the inn's cubes are refused", async () =>
    {
        const inn = hearthmere.index.objects.findIndex((entry) => entry.name === "inn");
        const columns = hearthmere.zone.columns;
        const [key] = [...hearthmere.placed.owners].find(([, owner]) => owner === inn);
        const wall = [key % columns, Math.floor(key / (columns * columns)), Math.floor(key / columns) % columns];
        const answer = await hearthmere.apply([{ type: "cubes", cells: [[...wall, hearthmere.numbers.cobble]] }]);

        assert.deepEqual(answer.refused, [[...wall, inn]]);
        assert.deepEqual(answer.regions, []);
        assert.equal(answer.steps, 0, "A refused change became a step");
    });

    it("moves a part of a building in the building's frame, then applies the change to every building of the type", async () =>
    {
        const inn = hearthmere.index.objects.find((entry) => entry.name === "inn");
        const table = () => hearthmere.index.objects.find((entry) => entry.prop === inn.prop && entry.object === "table");
        const before = table();

        await hearthmere.apply([{ type: "move", prop: inn.prop, part: before.part, by: [1, 0, -2] }]);

        const moved = table();

        assert.deepEqual([moved.box[0] - before.box[0], moved.box[2] - before.box[2], moved.box[1]], [1, -2, before.box[1]]);
        assert.equal(moved.isOverride, true);

        await hearthmere.apply([{ type: "applyToAll", prop: inn.prop }]);

        assert.deepEqual(table().box, moved.box);
        assert.equal(table().isOverride, undefined);
        assert.equal(hearthmere.zone.props[inn.prop].parts, undefined);
        assert.ok(hearthmere.layouts.inn[before.part], "The inn's layout did not take the change");

        await hearthmere.undo();
        await hearthmere.undo();
        assert.deepEqual(table().box, before.box);
        assert.equal(hearthmere.context.prefabs.inn.layout, undefined, "Undo left the inn's layout changed");
    });

    it("breaks a building apart into terrain cubes and objects that stand where its parts stood", async () =>
    {
        const index = hearthmere.zone.props.findIndex((prop) => prop.prefab === "cottage");
        const cottage = hearthmere.index.objects.find((entry) => entry.prop === index && entry.part === undefined);
        const parts = hearthmere.index.objects.filter((entry) => entry.prop === index && entry.part !== undefined);
        const [x0, y0, z0] = cottage.box;
        const wall = [x0, y0 + 4, z0 + 2];
        const block = bakedBlock(hearthmere, wall);
        const terrain = hearthmere.blockAt(...wall);
        const count = hearthmere.zone.props.length;

        await hearthmere.apply([{ type: "breakApart", prop: index }]);

        const boxes = (entries) => entries.map((entry) => entry.object + " " + entry.box.join(",")).sort();
        const objects = hearthmere.index.objects.filter((entry) => entry.prop >= index && entry.prop < index + parts.length);

        assert.equal(hearthmere.zone.props.length, count - 1 + parts.length);
        assert.deepEqual(boxes(objects), boxes(parts));
        assert.notEqual(block, 0);
        assert.equal(hearthmere.blockAt(...wall), block, "The wall did not join the terrain");
        assert.equal(bakedBlock(hearthmere, wall), block);
        assert.equal(hearthmere.ownerOf(...wall), null);

        await hearthmere.undo();
        assert.equal(hearthmere.zone.props.length, count);
        assert.equal(hearthmere.blockAt(...wall), terrain);
    });

    it("keeps every object that stood in the chapel where it was when the chapel breaks apart", async () =>
    {
        const objects = () => hearthmere.index.objects.filter((entry) => entry.object).map((entry) => entry.object + " " + entry.box.join(",")).sort();
        const before = objects();

        await hearthmere.apply([{ type: "breakApart", prop: hearthmere.zone.props.findIndex((prop) => prop.prefab === "chapel") }]);

        assert.deepEqual(objects(), before);

        await hearthmere.undo();
    });

    it("copies a placement without its id, and moves and turns a prop", async () =>
    {
        const well = hearthmere.zone.props.findIndex((prop) => prop.object === "well");
        const before = { ...hearthmere.zone.props[well] };
        const count = hearthmere.zone.props.length;

        await hearthmere.apply([{ type: "copy", prop: well, by: [3, 0, 0] }, { type: "move", prop: well, by: [0, 0, 3], turns: 1 }]);

        assert.deepEqual(hearthmere.zone.props.at(-1), { ...before, x: before.x + 1 });
        assert.deepEqual([hearthmere.zone.props[well].z, hearthmere.zone.props[well].angle], [before.z + 1, 1.570796]);
        assert.equal(hearthmere.zone.props.length, count + 1);

        await hearthmere.undo();
        assert.deepEqual(hearthmere.zone.props[well], before);
    });

    it("keeps a placement on the half-cube grid and its turn under a full turn, however often it moves", async () =>
    {
        const well = hearthmere.zone.props.findIndex((prop) => prop.object === "well");
        const before = { ...hearthmere.zone.props[well] };
        const step = (by, turns) => ({ type: "move", prop: well, by, turns });

        await hearthmere.apply([step([1, 0, 0], 1), step([1, 0, 0], 1), step([1, 0, 0], 1), step([0, 0, 0], 1)]);

        assert.deepEqual([hearthmere.zone.props[well].x, hearthmere.zone.props[well].angle], [before.x + 1, 0]);

        await hearthmere.undo();
    });

    it("takes back a step the bake rejects", async () =>
    {
        const count = hearthmere.zone.props.length;
        const steps = hearthmere.state.steps;

        await assert.rejects(hearthmere.apply([{ type: "add", placement: { object: "nothingLikeThis", x: 0, z: 0 } }]), /unknown object/);
        assert.deepEqual([hearthmere.zone.props.length, hearthmere.state.steps], [count, steps]);
    });

    it("saves the zone file and the edited regions, which the bake then reads back", async () =>
    {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), "editor-"));

        fs.cpSync(path.join(CONTENT, "zones", "testfield"), path.join(root, "zones", "testfield"), { recursive: true });

        const session = await EditSession.open("testfield", root);
        const cell = openCell(session);
        const cobble = session.numbers.cobble;

        await session.apply([{ type: "cubes", cells: [[...cell, cobble]] }, { type: "move", prop: 0, by: [3, 0, 0] }]);
        assert.equal(session.zone.props[0].x, 1, "The well did not move a metre");

        const written = session.save();
        const folder = path.join(root, "zones", "testfield");
        const locked = Terrain.readLocked(folder, session.zone, session.numbers, "Zone", []);
        const region = locked.locked.get("0-0");
        const [x, y, z] = cell;
        const chunk = region.chunks.find((entry) => entry.x === Math.floor(x / CHUNK) && entry.y === Math.floor(y / CHUNK) && entry.z === Math.floor(z / CHUNK));

        const palette = JSON.parse(fs.readFileSync(path.join(CONTENT, "zones", "testfield", "regions", "blocks.json"), "utf8"));
        const isRenumbered = JSON.stringify(palette) !== JSON.stringify(session.context.blocks.map((block) => block.id));

        assert.deepEqual(written.sort(), ["zones/testfield/regions/0-0.bin", ...(isRenumbered ? ["zones/testfield/regions/blocks.json"] : []), "zones/testfield/zone.json"]);
        assert.equal(chunk.cells[((y % CHUNK) * CHUNK + (z % CHUNK)) * CHUNK + (x % CHUNK)], cobble);
        assert.equal(JSON.parse(fs.readFileSync(path.join(folder, "zone.json"), "utf8")).props[0].x, session.zone.props[0].x);
        assert.equal(session.state.isDirty, false);
        fs.rmSync(root, { recursive: true });
    });
});

describe("Painted ages", () =>
{
    it("paint columns, refuse ages out of range, undo and redo, and save for the bake to read back", async () =>
    {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), "editor-"));

        fs.cpSync(path.join(CONTENT, "zones", "testfield"), path.join(root, "zones", "testfield"), { recursive: true });

        const session = await EditSession.open("testfield", root);
        const [x, , z] = openCell(session);
        const zoneAge = session.zone.weathering?.age ?? 0;
        const answer = await session.apply([{ type: "ages", columns: [[x, z, 80], [x + 1, z, 35], [-1, 0, 5], [x, z + 1, 101]] }]);

        assert.deepEqual([bakedAge(session, x, z), bakedAge(session, x + 1, z), bakedAge(session, x, z + 1)], [80, 35, zoneAge]);
        assert.deepEqual(answer.messages, ["2 ages were outside the zone or not whole numbers from 0 to 100."]);

        await session.undo();
        assert.deepEqual([bakedAge(session, x, z), bakedAge(session, x + 1, z)], [zoneAge, zoneAge]);

        await session.redo();
        session.save();

        const reopened = await EditSession.open("testfield", root);

        assert.deepEqual([bakedAge(reopened, x, z), bakedAge(reopened, x + 1, z)], [80, 35]);
        fs.rmSync(root, { recursive: true });
    });

    it("leave a placement's own age over its footprint", async () =>
    {
        const prop = hearthmere.zone.props.findIndex((entry) => entry.age !== undefined);
        const { box } = hearthmere.index.objects.find((entry) => entry.prop === prop && entry.box);
        const [column, row] = [box[0] + 1, box[2] + 1];

        await hearthmere.apply([{ type: "ages", columns: [[column, row, 5]] }]);
        assert.equal(bakedAge(hearthmere, column, row), hearthmere.zone.props[prop].age);
        await hearthmere.undo();
    });
});

describe("Capture", () =>
{
    // A stone arch, three cubes wide, two deep and two high, on open ground.
    const ARCH = [46, 18, 15];

    async function withArch(check)
    {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), "editor-"));

        fs.cpSync(path.join(CONTENT, "zones", "testfield"), path.join(root, "zones", "testfield"), { recursive: true });

        const session = await EditSession.open("testfield", root);
        const [x, y, z] = ARCH;
        const cells = [];

        for(let dy = 0; dy < 2; dy++)
        {
            for(let dz = 0; dz < 2; dz++)
            {
                for(let dx = 0; dx < 3; dx++) { if(!(dx === 1 && dy === 0)) { cells.push([x + dx, y + dy, z + dz, dy === 1 ? session.numbers.planks : session.numbers.stone]); } }
            }
        }

        await session.apply([{ type: "cubes", cells }]);

        try
        {
            await check(session, root, cells);
        }
        finally
        {
            fs.rmSync(root, { recursive: true });
        }
    }

    it("saves the cubes in a box as a prefab, trimmed, and puts the prefab in their place, turnable without losing a cube", async () =>
    {
        await withArch(async (session, root, cells) =>
        {
            const [x, y, z] = ARCH;
            const props = session.zone.props.length;
            const answer = await session.capture({ box: [x - 2, y, z - 2, x + 4, y + 3, z + 3], id: "testArch", as: "prefab", replace: true });
            const saved = JSON.parse(fs.readFileSync(path.join(root, "prefabs", "testArch.json"), "utf8"));
            const owner = session.ownerOf(...cells[0].slice(0, 3));
            const owned = () => [...session.placed.owners.values()].filter((index) => index === owner).length;

            assert.deepEqual([answer.written, saved.cells, saved.palette[0]], [["prefabs/testArch.json"], [3, 2, 2], null]);
            assert.equal(session.zone.props.length, props + 1);
            assert.notEqual(owner, null, "The arch's cubes do not belong to the new prefab");
            assert.deepEqual(cells.map((cell) => bakedBlock(session, cell)), cells.map((cell) => cell[3]));
            assert.equal(owned(), cells.length);

            await session.apply([{ type: "move", prop: props, turns: 1 }]);
            assert.equal(owned(), cells.length, "A quarter turn lost or doubled cubes");

            await session.undo();
            await session.undo();
            assert.equal(session.zone.props.length, props);
            assert.deepEqual(cells.map((cell) => bakedBlock(session, cell)), cells.map((cell) => cell[3]));
            assert.equal(session.ownerOf(...cells[0].slice(0, 3)), null);
        });
    });

    it("saves the cubes as an object of eight fine cubes a side for each, without replacing them", async () =>
    {
        await withArch(async (session, root) =>
        {
            const [x, y, z] = ARCH;
            const props = session.zone.props.length;
            const answer = await session.capture({ box: [x, y, z, x + 2, y + 1, z + 1], id: "testArchPiece", as: "object", replace: false });
            const saved = JSON.parse(fs.readFileSync(path.join(root, "objects", "testArchPiece.json"), "utf8"));
            const fine = saved.runs.reduce((sum, value, i) => sum + (i % 2 === 1 && saved.runs[i - 1] > 0 ? value : 0), 0);

            assert.deepEqual([answer.written, saved.cells, session.zone.props.length], [["objects/testArchPiece.json"], [3, 2, 2], props]);
            assert.equal(fine, 10 * 8 * 8 * 8);
            assert.deepEqual(session.context.objects.testArchPiece.cells, [3, 2, 2]);
        });
    });

    it("copies a placement's cubes but leaves them, and refuses a taken name, an empty box and an object too big", async () =>
    {
        await withArch(async (session) =>
        {
            const [x, y, z] = ARCH;
            const well = session.index.objects.find((entry) => entry.prop === 0).box;
            const props = session.zone.props.length;
            const answer = await session.capture({ box: well, id: "testWell", as: "prefab", replace: true });

            assert.equal(session.zone.props.length, props);
            assert.match(answer.messages[0], /belong to/);
            await assert.rejects(session.capture({ box: well, id: "testWell", as: "prefab" }), /exists already/);
            await assert.rejects(session.capture({ box: [x, y + 5, z, x + 2, y + 6, z + 1], id: "testAir", as: "prefab" }), /no cubes/);
            await assert.rejects(session.capture({ box: [x - 10, y - 1, z, x + 2, y + 1, z + 1], id: "testWide", as: "object" }), /at most 8 cubes/);
        });
    });
});

describe("New zones", () =>
{
    const contentRoot = () =>
    {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), "zones-"));

        fs.mkdirSync(path.join(root, "zones", "testfield"), { recursive: true });
        fs.copyFileSync(path.join(CONTENT, "zones", "testfield", "zone.json"), path.join(root, "zones", "testfield", "zone.json"));

        return root;
    };
    const middle = (session) => session.terrain.surfaces[(session.zone.columns / 2) * session.zone.columns + session.zone.columns / 2];

    it("starts from the starter recipe, draws a recipe's map without a step, and runs a new recipe as a step that undo takes back", async () =>
    {
        const root = contentRoot();
        const session = await EditSession.create("vale", root, { name: "the Vale", size: 128, from: "testfield" });
        const flat = { ...Recipe.starter(), base: { kind: "flat", height: 5 } };
        const hills = middle(session);

        assert.deepEqual([session.state.isLocked, session.state.recipe, session.state.water], [false, Recipe.starter(), Recipe.WATER.value]);
        assert.equal(session.zone.lighting.sky.top, JSON.parse(fs.readFileSync(path.join(root, "zones", "testfield", "zone.json"), "utf8")).lighting.sky.top);
        assert.match(session.map(flat, 2).map, /^data:image\/png;base64,/);
        assert.equal(session.state.steps, 0);

        const answer = await session.apply([{ type: "terrain", recipe: flat, water: 2 }]);

        assert.deepEqual(answer.regions.sort(), Terrain.regionNames(session.zone.columns).sort());
        assert.deepEqual([middle(session), session.zone.water], [session.zone.base + 15, session.zone.base + 6]);

        await session.undo();
        assert.deepEqual([middle(session), session.zone.water], [hills, session.zone.base - 3]);

        const broken = await session.apply([{ type: "terrain", recipe: { ...flat, base: { kind: "mountains" } }, water: 2 }]);
        const cubes = await session.apply([{ type: "cubes", cells: [[10, 60, 10, 1]] }]);

        assert.deepEqual([broken.messages, broken.steps], [["The terrain needs a base, one of flat, hills."], 0]);
        assert.deepEqual([cubes.messages, cubes.refused], [["Lock in the terrain before changing its cubes or ages."], [[10, 60, 10, null]]]);
        assert.equal(fs.existsSync(path.join(root, "zones", "vale")), false, "The new zone reached content/ before it was saved");
        fs.rmSync(root, { recursive: true });
    });

    it("locks the terrain in as cubes and bounds that the zone opens with again, and drops the recipe", async () =>
    {
        const root = contentRoot();
        const session = await EditSession.create("vale", root, { name: "the Vale", size: 128, from: "testfield" });
        const surfaces = session.terrain.surfaces.slice();
        const bounds = session.terrain.bounds;
        const written = await session.lockIn();
        const saved = JSON.parse(fs.readFileSync(path.join(root, "zones", "vale", "zone.json"), "utf8"));
        const reopened = await EditSession.open("vale", root);

        assert.deepEqual(written.sort(), ["zones/vale/regions/0-0.bin", "zones/vale/regions/0-1.bin", "zones/vale/regions/1-0.bin", "zones/vale/regions/1-1.bin", "zones/vale/regions/blocks.json", "zones/vale/regions/bounds.json", "zones/vale/zone.json"]);
        assert.deepEqual([saved.terrain, session.state.isLocked, session.state.recipe], [undefined, true, undefined]);
        assert.deepEqual(reopened.terrain.surfaces, surfaces);
        assert.deepEqual(Object.keys(reopened.terrain.bounds), ["north", "east", "south", "west"]);
        assert.deepEqual(reopened.terrain.bounds, bounds);
        assert.deepEqual((await reopened.apply([{ type: "cubes", cells: [[10, surfaces[10 * 384 + 10], 10, 1]] }])).refused, []);
        fs.rmSync(root, { recursive: true });
    });
});

describe("Editor routes", () =>
{
    const request = (url, { method = "POST", headers = {}, body = "{}" } = {}) => new Promise((resolve, reject) =>
    {
        const sent = http.request(url, { method, headers }, (response) =>
        {
            const parts = [];

            response.on("data", (part) => parts.push(part));
            response.on("end", () => resolve({ status: response.statusCode, body: JSON.parse(Buffer.concat(parts).toString("utf8")) }));
        });

        sent.on("error", reject);
        sent.end(body);
    });

    it("take changes only as JSON from the server's own address, and serve the zone files the session baked", async () =>
    {
        const notesRoot = fs.mkdtempSync(path.join(os.tmpdir(), "notes-"));
        const server = await Server.startServer({ port: 0, editor: new EditorRoutes({ shouldBake: false, notesRoot }) });
        const json = { "Content-Type": "application/json" };

        try
        {
            const form = await request(server.url + "/editor/testfield/undo", { headers: { "Content-Type": "text/plain" } });
            const foreign = await request(server.url + "/editor/testfield/undo", { headers: { ...json, Origin: "http://elsewhere.example" } });
            const rebound = await request(server.url + "/editor/testfield/undo", { headers: { ...json, Host: "elsewhere.example:80" } });
            const opened = await request(server.url + "/editor/testfield/open", { headers: json });
            const notes = await request(server.url + "/editor/testfield/notes", { headers: json, body: JSON.stringify([{ id: 1, text: "Here" }]) });
            const read = await request(server.url + "/editor/testfield/notes", { method: "GET" });

            assert.deepEqual([form.status, foreign.status, rebound.status], [403, 403, 403]);
            assert.deepEqual([opened.status, opened.body.isOpen], [200, true]);
            assert.deepEqual([notes.body, read.body], [{ count: 1 }, [{ id: 1, text: "Here" }]]);
        }
        finally
        {
            await server.close();
            fs.rmSync(notesRoot, { recursive: true });
        }
    });

    it("create a zone that the server serves from memory, and draw its map", async () =>
    {
        const contentRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zones-"));
        const server = await Server.startServer({ port: 0, editor: new EditorRoutes({ shouldBake: false, contentRoot }) });
        const json = { "Content-Type": "application/json" };
        const body = JSON.stringify({ name: "the Vale", size: 128, from: "testfield" });

        fs.cpSync(path.join(CONTENT, "zones", "testfield"), path.join(contentRoot, "zones", "testfield"), { recursive: true });

        try
        {
            const created = await request(server.url + "/editor/vale/create", { headers: json, body });
            const again = await request(server.url + "/editor/vale/create", { headers: json, body });
            const index = await request(server.url + "/assets/zones/vale/index.json", { method: "GET", body: "" });
            const opened = await request(server.url + "/editor/vale/open", { headers: json });
            const map = await request(server.url + "/editor/vale/map", { headers: json, body: JSON.stringify({ recipe: created.body.recipe, water: 0 }) });

            assert.deepEqual([created.status, created.body.isLocked, again.status], [200, false, 400]);
            assert.deepEqual([index.status, index.body.name], [200, "the Vale"]);
            assert.deepEqual(Object.keys(opened.body.kinds.features), ["flat", "basin", "rise", "hilly", "hillyBand", "river", "pass"]);
            assert.match(map.body.map, /^data:image\/png;base64,/);
        }
        finally
        {
            await server.close();
            fs.rmSync(contentRoot, { recursive: true });
        }
    });

    it("capture the cubes in a box through the capture route", { timeout: 30000 }, async () =>
    {
        const contentRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zones-"));
        const server = await Server.startServer({ port: 0, editor: new EditorRoutes({ shouldBake: false, contentRoot }) });
        const json = { "Content-Type": "application/json" };

        fs.cpSync(path.join(CONTENT, "zones", "testfield"), path.join(contentRoot, "zones", "testfield"), { recursive: true });

        try
        {
            const captured = await request(server.url + "/editor/testfield/capture", { headers: json, body: JSON.stringify({ box: [40, 10, 10, 50, 20, 20], id: "testHill", as: "prefab", replace: false }) });

            assert.deepEqual([captured.status, captured.body.written], [200, ["prefabs/testHill.json"]]);
            assert.ok(fs.existsSync(path.join(contentRoot, "prefabs", "testHill.json")));
        }
        finally
        {
            await server.close();
            fs.rmSync(contentRoot, { recursive: true });
        }
    });
});
