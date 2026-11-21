import * as Catalogue from "./catalogue.js";
import * as Names from "./names.js";

const NAME_PATTERN = /^[A-Za-z][A-Za-z' -]{0,19}$/;

const DEFAULT_LOOK =
{
    name: "Adventurer",
    race: "human",
    body: "male",
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
    race: Catalogue.RACES,
    body: Catalogue.BODY_TYPES,
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
    constructor(data = {})
    {
        this.listeners = [];
        this.data = Appearance.normalise(data);
    }

    get(key)
    {
        return this.data[key];
    }

    equipped(slot)
    {
        return { ...this.data.equipment[slot] };
    }

    get race()
    {
        return Catalogue.find(Catalogue.RACES, this.data.race);
    }

    get bodyType()
    {
        return Catalogue.find(Catalogue.BODY_TYPES, this.data.body);
    }

    /* CHOICES ****************************************************************/

    choices(key)
    {
        return Appearance.choicesFor(key, this.data.race);
    }

    static choicesFor(key, raceId)
    {
        if(OPTION_LISTS[key]) { return OPTION_LISTS[key].map((option) => option.id); }
        if(key === "skin") { return [...Catalogue.find(Catalogue.RACES, raceId).skins]; }
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
        if(!Appearance.isValid(key, value, this.data.race)) { throw new Error("Invalid " + key + ": " + value); }
        if(this.data[key] === value) { return; }

        this.data[key] = value;

        if(key === "race") { this.fitSkinToRace(); }

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
        this.data = Appearance.normalise(data);
        this.emitChange("all");
    }

    randomise(random, options = {})
    {
        this.replace(Appearance.randomData(random, options));
    }

    fitSkinToRace()
    {
        const skins = this.race.skins;

        if(!skins.includes(this.data.skin)) { this.data.skin = skins[Math.min(1, skins.length - 1)]; }
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

        return { ...this.data, equipment };
    }

    clone()
    {
        return new Appearance(this.toJSON());
    }

    /* VALIDATION *************************************************************/

    static isValid(key, value, raceId)
    {
        if(key === "name") { return typeof value === "string" && NAME_PATTERN.test(value); }
        if(key === "height" || key === "build") { return Number.isFinite(value) && value >= -1 && value <= 1; }

        const choices = Appearance.choicesFor(key, raceId);

        return choices !== null && choices.includes(value);
    }

    static normalise(data)
    {
        const source = data && typeof data === "object" ? data : {};
        const result = {};
        const raceId = Appearance.isValid("race", source.race, null) ? source.race : DEFAULT_LOOK.race;

        for(const key of Object.keys(DEFAULT_LOOK))
        {
            const isUsable = Appearance.isValid(key, source[key], raceId);

            result[key] = isUsable ? source[key] : DEFAULT_LOOK[key];
        }

        result.race = raceId;

        if(!Appearance.isValid("skin", result.skin, raceId))
        {
            result.skin = Catalogue.find(Catalogue.RACES, raceId).skins[1];
        }

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

    static randomData(random, options = {})
    {
        const race = options.race ?? random.pick(Catalogue.RACES).id;
        const body = options.body ?? random.pick(Catalogue.BODY_TYPES).id;
        const archetype = Catalogue.find(Catalogue.ARCHETYPES, options.archetype) ?? random.pick(Catalogue.ARCHETYPES);
        const raceInfo = Catalogue.find(Catalogue.RACES, race);
        const isFemale = body === "female";

        const longStyles = ["long", "tail", "braids", "topknot", "swept"];
        const shortStyles = ["crop", "swept", "bald", "shaved", "crest", "tail", "long"];
        const hair = random.pick(isFemale ? longStyles : shortStyles);
        const beardOdds = race === "dwarf" ? 0.95 : 0.55;
        const beards = race === "dwarf" ? ["full", "long", "forked"] : ["stubble", "stubble", "moustache", "short", "full", "long"];
        const beard = !isFemale && random.chance(beardOdds) ? random.pick(beards) : "none";

        return {
            name: Names.generate(random, race),
            race,
            body,
            height: Math.round(random.range(-0.6, 0.6) * 100) / 100,
            build: Math.round(random.range(-0.6, 0.6) * 100) / 100,
            skin: random.pick(raceInfo.skins),
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
