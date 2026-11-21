import { Log } from "./log.js";

const KEY = "foreverquest.character";

export class CharacterStore
{
    constructor(storage)
    {
        this.storage = storage;
    }

    load()
    {
        try
        {
            const text = this.storage?.getItem(KEY);

            return text ? JSON.parse(text) : null;
        }
        catch(error)
        {
            Log.warn("Could not read the saved character; starting with a new one", error);

            return null;
        }
    }

    save(appearance)
    {
        if(!this.storage) { return false; }

        try
        {
            this.storage.setItem(KEY, JSON.stringify(appearance.toJSON()));

            return true;
        }
        catch(error)
        {
            Log.warn("Could not save the character", error);

            return false;
        }
    }
}
