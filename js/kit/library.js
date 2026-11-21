const INDEX = "models/index.json";
const MIGRATIONS = "migrations.json";

export class Library
{
    constructor({ rigs, bodies, migrations })
    {
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
