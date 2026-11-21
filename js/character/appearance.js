import * as Names from "./names.js";

const NAME_PATTERN = /^[A-Za-z][A-Za-z' -]{0,19}$/;
const VERSION = 2;
const FIELDS = ["name", "body", "variant", "height", "build", "skin", "face", "nose", "eyes", "hair", "hairColour", "beard", "markings"];
const PART_FIELDS = ["face", "nose", "hair", "beard", "markings"];
const PALETTE_FIELDS = { eyes: "eyes", hairColour: "hair" };


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

    get gearSlots()
    {
        return Appearance.gearSlots(this.library, this.data.body);
    }

    /* CHOICES ****************************************************************/

    choices(key)
    {
        return Appearance.choicesFor(this.library, key, this.data.body);
    }

    static choicesFor(library, key, bodyId)
    {
        const body = library.body(bodyId);

        if(PART_FIELDS.includes(key)) { return library.partsFor(key).map((part) => part.id); }
        if(PALETTE_FIELDS[key]) { return [...library.palette(PALETTE_FIELDS[key])]; }
        if(key === "body") { return library.playableBodies.map((option) => option.id); }
        if(key === "variant") { return body.variants.map((variant) => variant.id); }
        if(key === "skin") { return [...body.skins]; }

        return null;
    }

    static gearSlots(library, bodyId)
    {
        return library.rig(library.body(bodyId).rig).gear;
    }

    static tintChoices(library, slot, itemId, part)
    {
        const item = library.part(slot, itemId);
        const palette = item?.tints[part === "trim" ? "trim" : "primary"];

        return palette ? [...library.palette(palette)] : [];
    }

    /* CHANGES ****************************************************************/

    set(key, value)
    {
        if(!FIELDS.includes(key)) { throw new Error("Unknown appearance field: " + key); }
        if(!Appearance.isValid(this.library, key, value, this.data.body)) { throw new Error("Invalid " + key + ": " + value); }
        if(this.data[key] === value) { return; }

        this.data[key] = value;

        if(key === "body")
        {
            Appearance.fitToBody(this.library, this.data);
            this.data.equipment = Appearance.normaliseEquipment(this.library, value, this.data.equipment);
        }

        this.emitChange(key);
    }

    equip(slot, itemId)
    {
        const item = this.gearSlots.some((entry) => entry.id === slot) ? this.library.part(slot, itemId) : null;

        if(!item) { throw new Error("Unknown item for " + slot + ": " + itemId); }

        const current = this.data.equipment[slot];

        if(current.item === itemId) { return; }

        this.data.equipment[slot] = Appearance.fitTints(this.library, item, current);
        this.emitChange("equipment");
    }

    tint(slot, part, colour)
    {
        const current = this.data.equipment[slot];
        const field = part === "trim" ? "trim" : "colour";

        if(!Appearance.tintChoices(this.library, slot, current.item, part).includes(colour))
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

        for(const field of PART_FIELDS)
        {
            if(typeof source[field] === "string") { source[field] = library.migrateId("part", field + "/" + source[field]).split("/")[1]; }
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
        const defaults = { ...library.appearance.defaults, height: 0, build: 0 };
        const source = Appearance.migrate(library, data);
        const bodyId = Appearance.isValid(library, "body", source.body, null) ? source.body : defaults.body;
        const result = {};

        for(const key of FIELDS)
        {
            result[key] = Appearance.isValid(library, key, source[key], bodyId) ? source[key] : defaults[key];
        }

        result.body = bodyId;
        Appearance.fitToBody(library, result);
        result.equipment = Appearance.normaliseEquipment(library, bodyId, source.equipment);

        return result;
    }

    static normaliseEquipment(library, bodyId, source)
    {
        const equipment = {};
        const given = source && typeof source === "object" ? source : {};
        const defaults = library.appearance.defaults.equipment;

        for(const slot of Appearance.gearSlots(library, bodyId))
        {
            const entry = given[slot.id] && typeof given[slot.id] === "object" ? given[slot.id] : {};
            const itemId = typeof entry.item === "string" ? library.migrateId("part", slot.id + "/" + entry.item).split("/")[1] : null;
            const item = library.part(slot.id, itemId) ?? library.part(slot.id, defaults[slot.id]) ?? library.partsFor(slot.id)[0];

            equipment[slot.id] = Appearance.fitTints(library, item, entry);
        }

        return equipment;
    }

    static fitTints(library, item, previous)
    {
        const colours = Appearance.tintChoices(library, item.slot, item.id, "primary");
        const trims = Appearance.tintChoices(library, item.slot, item.id, "trim");

        return {
            item: item.id,
            colour: colours.includes(previous.colour) ? previous.colour : item.colour,
            trim: trims.includes(previous.trim) ? previous.trim : item.trimColour,
        };
    }

    /* RANDOM *****************************************************************/

    static randomData(library, random, options = {})
    {
        const rules = library.appearance.random;
        const bodyId = options.body ?? random.pick(library.playableBodies).id;
        const body = library.body(bodyId);
        const variant = options.variant ?? random.pick(body.variants).id;
        const archetype = library.archetypes.find((entry) => entry.id === options.archetype) ?? random.pick(library.archetypes);
        const beard = { ...rules.beard, ...body.random.beard };
        const hairStyles = rules.hair[variant] ?? rules.hair.male;
        const pick = (slot) => random.pick(library.partsFor(slot)).id;

        const hair = random.pick(hairStyles);
        const hasBeard = beard.variants.includes(variant) && random.chance(beard.odds);
        const beardId = hasBeard ? random.pick(beard.from) : "none";

        return {
            version: VERSION,
            name: Names.generate(random, bodyId),
            body: bodyId,
            variant,
            height: Math.round(random.range(-0.6, 0.6) * 100) / 100,
            build: Math.round(random.range(-0.6, 0.6) * 100) / 100,
            skin: random.pick(body.skins),
            face: pick("face"),
            nose: pick("nose"),
            eyes: random.pick(library.palette("eyes")),
            hair,
            hairColour: random.pick(library.palette("hair")),
            beard: beardId,
            markings: random.chance(1 - rules.markings.odds) ? "none" : pick("markings"),
            equipment: Appearance.randomEquipment(library, random, archetype, bodyId),
        };
    }

    static randomEquipment(library, random, archetype, bodyId)
    {
        const rules = library.appearance.random;
        const cloth = library.palette("cloth");
        const metal = library.palette("metal");
        const equipment = {};
        const preferred = [random.pick(cloth), random.pick(cloth), ...rules.favouredColours, random.pick(metal.slice(0, rules.favouredMetals))];
        const pickTint = (choices) =>
        {
            if(choices.length === 0) { return null; }

            const favoured = preferred.filter((colour) => choices.includes(colour));

            return random.pick(favoured.length > 0 ? favoured : choices);
        };

        for(const slot of Appearance.gearSlots(library, bodyId))
        {
            const itemId = random.pick(archetype.slots[slot.id] ?? ["none"]);

            equipment[slot.id] =
            {
                item: itemId,
                colour: pickTint(Appearance.tintChoices(library, slot.id, itemId, "primary")),
                trim: pickTint(Appearance.tintChoices(library, slot.id, itemId, "trim")),
            };
        }

        return equipment;
    }
}
