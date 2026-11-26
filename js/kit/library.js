import { StampSheet } from "./stamp-sheet.js";

const INDEX = "models/index.json";
const PARTS = "models/parts/index.json";
const MIGRATIONS = "migrations.json";

export class Library
{
    constructor({ rigs, bodies, parts = [], stamps = null, palettes = {}, archetypes = [], appearance = null, clips = [], constructs = {}, migrations })
    {
        this.constructs = new Map(Object.entries(constructs));
        this.clipSets = new Map(clips.map((set) => [set.rig, set]));
        this.palettes = palettes;
        this.archetypes = archetypes;
        this.appearance = appearance;
        this.parts = new Map(parts.map((part) => [part.slot + "/" + part.id, part]));
        this.stamps = stamps;
        this.rigs = new Map(rigs.map((rig) => [rig.id, rig]));
        this.bodyList = bodies;
        this.bodies = new Map(bodies.map((body) => [body.id, body]));
        this.migrations = migrations;
    }

    static async load(source)
    {
        const index = await source.json(INDEX);
        const read = (folder, ids) => Promise.all(ids.map((id) => source.json("models/" + folder + "/" + id + ".json")));

        return new Library(
        {
            rigs: await read("rigs", index.rigs),
            bodies: await read("bodies", index.bodies),
            parts: await read("parts", await source.json(PARTS)),
            stamps: new StampSheet(await source.json("models/stamps.json"), await source.image("models/stamps.png")),
            palettes: await source.json("models/palettes.json"),
            archetypes: await source.json("models/archetypes.json"),
            appearance: await source.json("models/appearance.json"),
            clips: await Promise.all((await source.json("models/clips/index.json")).map((rig) => source.json("models/clips/" + rig + ".json"))),
            constructs: await source.json("models/constructs.json"),
            migrations: await source.json(MIGRATIONS),
        });
    }

    rig(id)
    {
        return this.rigs.get(id) ?? null;
    }

    body(id)
    {
        return this.bodies.get(id) ?? null;
    }

    construct(id)
    {
        return this.constructs.get(id) ?? null;
    }

    part(slot, id)
    {
        return this.parts.get(slot + "/" + id) ?? null;
    }

    partsFor(slot)
    {
        return [...this.parts.values()].filter((part) => part.slot === slot);
    }

    clips(rigId)
    {
        return this.clipSets.get(rigId) ?? null;
    }

    palette(name)
    {
        return this.palettes[name] ?? [];
    }

    get playableBodies()
    {
        return this.bodyList.filter((body) => body.playable);
    }

    get allBodies()
    {
        return [...this.bodyList];
    }

    migrateId(kind, id)
    {
        return this.migrations[kind]?.[id] ?? id;
    }
}
