const ALL = "all";
const OTHER = { type: "other", pack: "core" };


/******************************************************************************/
/* PALETTE FILTER                                                             */
/******************************************************************************/

// `types` and `packs` hold [id, label] pairs; `entries` maps an id to
// { type, pack }, and an id it lacks is of type Other in the core pack.
// `extras` are type choices the palette fills itself, such as Recent, which
// leave the type unfiltered.
export class PaletteFilter
{
    constructor({ types, packs, entries, extras = [] })
    {
        this.types = types;
        this.packs = packs;
        this.entries = entries;
        this.extras = extras;
        this.type = ALL;
        this.pack = ALL;
    }

    static get ALL()
    {
        return ALL;
    }

    entryOf(id)
    {
        return this.entries[id] ?? OTHER;
    }

    matches(id)
    {
        const entry = this.entryOf(id);
        const isTypeShown = this.type === ALL || this.extras.some(([extra]) => extra === this.type) || entry.type === this.type;

        return isTypeShown && (this.pack === ALL || entry.pack === this.pack);
    }

    set(key, value)
    {
        if(key === "type") { this.type = value; }
        if(key === "pack") { this.pack = value; }
    }

    reveal(id)
    {
        if(this.matches(id)) { return; }

        this.type = ALL;
        this.pack = ALL;
    }

    // A row of two choices; the type list offers Other only when one of `ids`
    // is untyped.
    fields(ids, onChange)
    {
        const hasOther = ids.some((id) => this.entries[id] === undefined);
        const types = [[ALL, "All types"], ...this.types, ...(hasOther ? [[OTHER.type, "Other"]] : []), ...this.extras];
        const packs = [[ALL, "All packs"], ...this.packs];
        const field = (key, choices) => ({ key, choices, value: this[key], onChange: (value) => { this.set(key, value); onChange(); } });

        return [field("type", types), field("pack", packs)];
    }
}
