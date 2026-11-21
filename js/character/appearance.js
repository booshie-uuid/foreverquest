import * as Catalogue from "./catalogue.js";
import * as Names from "./names.js";

const NAME_PATTERN = /^[A-Za-z][A-Za-z' -]{0,19}$/;
const VERSION = 2;

const DEFAULT_LOOK =
{
    name: "Adventurer",
    body: "human",
    variant: "male",
    height: 0,
    build: 0,
    skin: "#b49a84",
    face: "1",
    nose: "straight",
    eyes: "#2b3a4a",
    hair: "crop",
    hairColour: "#3f2c1e",
    beard: "stubble",
    markings: "none",
};

const DEFAULT_GEAR =
{
    head: "none",
    chest: "jerkin",
    legs: "trousers",
    feet: "boots",
    hands: "gloves",
    back: "cloak",
    mainHand: "sword",
    offHand: "none",
};

const OPTION_LISTS =
{
    face: Catalogue.FACES,
    nose: Catalogue.NOSES,
    hair: Catalogue.HAIR_STYLES,
    beard: Catalogue.BEARD_STYLES,
    markings: Catalogue.MARKINGS,
};


/******************************************************************************/
/* APPEARANCE                                                                 */
/******************************************************************************/

export class Appearance
{
    static VERSION = VERSION;

    constructor(library, data = {})
    {
        this.library = library;
        this.listeners = [];
        this.data = Appearance.normalise(library, data);
    }

    get(key)
    {
        return this.data[key];
    }

    equipped(slot)
    {
        return { ...this.data.equipment[slot] };
    }

    get body()
    {
        return this.library.body(this.data.body);
    }

    get variant()
    {
        return this.body.variants.find((variant) => variant.id === this.data.variant);
    }

    /* CHOICES ****************************************************************/

    choices(key)
    {
        return Appearance.choicesFor(this.library, key, this.data.body);
    }

    static choicesFor(library, key, bodyId)
    {
        const body = library.body(bodyId);

        if(OPTION_LISTS[key]) { return OPTION_LISTS[key].map((option) => option.id); }
        if(key === "body") { return library.playableBodies.map((option) => option.id); }
        if(key === "variant") { return body.variants.map((variant) => variant.id); }
        if(key === "skin") { return [...body.skins]; }
        if(key === "eyes") { return [...Catalogue.EYE_COLOURS]; }
        if(key === "hairColour") { return [...Catalogue.HAIR_COLOURS]; }

        return null;
    }

    static tintChoices(slot, itemId, part)
    {
        const item = Catalogue.item(slot, itemId);
        const paletteId = part === "trim" ? item?.trim : item?.primary;

        return paletteId ? [...Catalogue.PALETTES[paletteId]] : [];
    }

    /* CHANGES ****************************************************************/

    set(key, value)
    {
        if(!(key in DEFAULT_LOOK)) { throw new Error("Unknown appearance field: " + key); }
        if(!Appearance.isValid(this.library, key, value, this.data.body)) { throw new Error("Invalid " + key + ": " + value); }
        if(this.data[key] === value) { return; }

        this.data[key] = value;

        if(key === "body") { Appearance.fitToBody(this.library, this.data); }

        this.emitChange(key);
    }

    equip(slot, itemId)
    {
        const item = Catalogue.item(slot, itemId);

        if(!item) { throw new Error("Unknown item for " + slot + ": " + itemId); }

        const current = this.data.equipment[slot];

        if(current.item === itemId) { return; }

        this.data.equipment[slot] = Appearance.fitTints(slot, item, current);
        this.emitChange("equipment");
    }

    tint(slot, part, colour)
    {
        const current = this.data.equipment[slot];
        const field = part === "trim" ? "trim" : "colour";

        if(!Appearance.tintChoices(slot, current.item, part).includes(colour))
        {
            throw new Error("Invalid " + part + " colour for " + slot + ": " + colour);
        }

        if(current[field] === colour) { return; }

        this.data.equipment[slot] = { ...current, [field]: colour };
        this.emitChange("equipment");
    }

    replace(data)
    {
        this.data = Appearance.normalise(this.library, data);
        this.emitChange("all");
    }

    randomise(random, options = {})
    {
        this.replace(Appearance.randomData(this.library, random, options));
    }

    static fitToBody(library, data)
    {
        const body = library.body(data.body);

        if(!body.variants.some((variant) => variant.id === data.variant)) { data.variant = body.variants[0].id; }
        if(!body.skins.includes(data.skin)) { data.skin = body.skins[Math.min(1, body.skins.length - 1)]; }
    }

    /* EVENTS *****************************************************************/

    onChange(listener)
    {
        this.listeners.push(listener);

        return () =>
        {
            this.listeners = this.listeners.filter((entry) => entry !== listener);
        };
    }

    emitChange(key)
    {
        for(const listener of this.listeners) { listener(this, key); }
    }

    /* SERIALISATION **********************************************************/

    toJSON()
    {
        const equipment = {};

        for(const slot of Object.keys(this.data.equipment))
        {
            equipment[slot] = { ...this.data.equipment[slot] };
        }

        return { version: VERSION, ...this.data, equipment };
    }

    clone()
    {
        return new Appearance(this.library, this.toJSON());
    }

    // Version 1 named the body "race" and the variant "body". Every saved
    // version 1 record has a race field; a record with neither is current.
    static migrate(library, data)
    {
        const source = data && typeof data === "object" ? { ...data } : {};

        if(source.version === undefined && "race" in source)
        {
            source.variant = source.body;
            source.body = source.race;
            delete source.race;
        }

        delete source.version;

        if(typeof source.body === "string") { source.body = library.migrateId("body", source.body); }

        if(typeof source.body === "string" && typeof source.variant === "string")
        {
            source.variant = library.migrateId("body-variant", source.body + "/" + source.variant).split("/")[1];
        }

        return source;
    }

    /* VALIDATION *************************************************************/

    static isValid(library, key, value, bodyId)
    {
        if(key === "name") { return typeof value === "string" && NAME_PATTERN.test(value); }
        if(key === "height" || key === "build") { return Number.isFinite(value) && value >= -1 && value <= 1; }
        if(key === "body") { return library.body(value) !== null; }

        const choices = Appearance.choicesFor(library, key, bodyId);

        return choices !== null && choices.includes(value);
    }

    static normalise(library, data)
    {
        const source = Appearance.migrate(library, data);
        const bodyId = Appearance.isValid(library, "body", source.body, null) ? source.body : DEFAULT_LOOK.body;
        const result = {};

        for(const key of Object.keys(DEFAULT_LOOK))
        {
            result[key] = Appearance.isValid(library, key, source[key], bodyId) ? source[key] : DEFAULT_LOOK[key];
        }

        result.body = bodyId;
        Appearance.fitToBody(library, result);
        result.equipment = Appearance.normaliseEquipment(source.equipment);

        return result;
    }

    static normaliseEquipment(source)
    {
        const equipment = {};
        const given = source && typeof source === "object" ? source : {};

        for(const slot of Catalogue.SLOTS)
        {
            const entry = given[slot.id] && typeof given[slot.id] === "object" ? given[slot.id] : {};
            const item = Catalogue.item(slot.id, entry.item) ?? Catalogue.item(slot.id, DEFAULT_GEAR[slot.id]);

            equipment[slot.id] = Appearance.fitTints(slot.id, item, entry);
        }

        return equipment;
    }

    static fitTints(slot, item, previous)
    {
        const colours = Appearance.tintChoices(slot, item.id, "primary");
        const trims = Appearance.tintChoices(slot, item.id, "trim");

        return {
            item: item.id,
            colour: colours.includes(previous.colour) ? previous.colour : item.colour ?? null,
            trim: trims.includes(previous.trim) ? previous.trim : item.trimColour ?? null,
        };
    }

    /* RANDOM *****************************************************************/

    static randomData(library, random, options = {})
    {
        const bodyId = options.body ?? random.pick(library.playableBodies).id;
        const body = library.body(bodyId);
        const variant = options.variant ?? random.pick(body.variants).id;
        const archetype = Catalogue.find(Catalogue.ARCHETYPES, options.archetype) ?? random.pick(Catalogue.ARCHETYPES);
        const isFemale = variant === "female";

        const longStyles = ["long", "tail", "braids", "topknot", "swept"];
        const shortStyles = ["crop", "swept", "bald", "shaved", "crest", "tail", "long"];
        const hair = random.pick(isFemale ? longStyles : shortStyles);
        const beardOdds = bodyId === "dwarf" ? 0.95 : 0.55;
        const beards = bodyId === "dwarf" ? ["full", "long", "forked"] : ["stubble", "stubble", "moustache", "short", "full", "long"];
        const beard = !isFemale && random.chance(beardOdds) ? random.pick(beards) : "none";

        return {
            version: VERSION,
            name: Names.generate(random, bodyId),
            body: bodyId,
            variant,
            height: Math.round(random.range(-0.6, 0.6) * 100) / 100,
            build: Math.round(random.range(-0.6, 0.6) * 100) / 100,
            skin: random.pick(body.skins),
            face: random.pick(Catalogue.FACES).id,
            nose: random.pick(Catalogue.NOSES).id,
            eyes: random.pick(Catalogue.EYE_COLOURS),
            hair,
            hairColour: random.pick(Catalogue.HAIR_COLOURS),
            beard,
            markings: random.chance(0.65) ? "none" : random.pick(Catalogue.MARKINGS).id,
            equipment: Appearance.randomEquipment(random, archetype),
        };
    }

    static randomEquipment(random, archetype)
    {
        const equipment = {};
        const preferred = [random.pick(Catalogue.CLOTH_COLOURS), random.pick(Catalogue.CLOTH_COLOURS), "#4a3424", "#2e241c", random.pick(Catalogue.METAL_COLOURS.slice(0, 4))];
        const pickTint = (choices) =>
        {
            if(choices.length === 0) { return null; }

            const favoured = preferred.filter((colour) => choices.includes(colour));

            return random.pick(favoured.length > 0 ? favoured : choices);
        };

        for(const slot of Catalogue.SLOTS)
        {
            const itemId = random.pick(archetype.slots[slot.id]);

            equipment[slot.id] =
            {
                item: itemId,
                colour: pickTint(Appearance.tintChoices(slot.id, itemId, "primary")),
                trim: pickTint(Appearance.tintChoices(slot.id, itemId, "trim")),
            };
        }

        return equipment;
    }
}
