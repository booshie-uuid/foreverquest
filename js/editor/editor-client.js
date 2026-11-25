// Every answer holds the session's state: { isDirty, canUndo, canRedo, steps }.
export class EditorClient
{
    constructor(zoneId, baseUrl = "")
    {
        this.zoneId = zoneId;
        this.baseUrl = baseUrl;
    }

    // A static host answers with a 404 or a page, not JSON.
    static async isAvailable(zoneId)
    {
        try
        {
            const response = await fetch("editor/" + zoneId + "/state");

            return response.ok && (response.headers.get("content-type") ?? "").startsWith("application/json");
        }
        catch
        {
            return false;
        }
    }

    // Resolves to the state, and the kinds of terrain recipe as `kinds`.
    open()
    {
        return this.post("open");
    }

    // `zone` holds the new zone's { name, size, from }, with `size` in metres
    // and `from` the zone whose lighting it takes.
    create(zone)
    {
        return this.post("create", zone);
    }

    // Resolves to { map }, a PNG data URL, without changing the zone.
    map(recipe, water)
    {
        return this.post("map", { recipe, water });
    }

    // `capture` holds { box, id, as, replace }: the box's corners in cells,
    // the new piece's name, "prefab" or "object", and whether the piece takes
    // the cubes' place. Resolves to { written, regions, messages } and the
    // state.
    capture(capture)
    {
        return this.post("capture", capture);
    }

    // `object` is an object's data, as its file in content/objects/ holds it.
    // Resolves to { written } and the state.
    saveObject(id, object)
    {
        return this.post("object", { id, object });
    }

    // Resolves to { written } and the state, once the terrain is cubes.
    lock()
    {
        return this.post("lock");
    }

    // `cell` is [x, y, z]. Resolves to { object }, the index of the owning
    // placement in the zone's objects, or null.
    owner(cell)
    {
        return this.post("owner", { cell });
    }

    // Resolves to { regions, refused, messages } and the state.
    apply(operations)
    {
        return this.post("apply", { operations });
    }

    undo()
    {
        return this.post("undo");
    }

    redo()
    {
        return this.post("redo");
    }

    save()
    {
        return this.post("save");
    }

    async notes()
    {
        const response = await fetch(this.baseUrl + "editor/" + this.zoneId + "/notes");

        if(!response.ok) { throw new Error("The notes could not be read: " + response.status); }

        return response.json();
    }

    saveNotes(notes)
    {
        return this.post("notes", notes);
    }

    async post(action, body = {})
    {
        const response = await fetch(this.baseUrl + "editor/" + this.zoneId + "/" + action, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const answer = await response.json();

        if(!response.ok) { throw new Error(answer.error ?? "The editor could not " + action + ": " + response.status); }

        return answer;
    }
}
