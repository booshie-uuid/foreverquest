import * as Bases from "../../content/terrain/bases.js";


/******************************************************************************/
/* KINDS                                                                      */
/******************************************************************************/

// A setting is a number from `min` to `max`, or one of `choices`, each
// [value, label]. A setting with `when`, [key, value], applies only while
// that other setting holds that value. A feature's `shape` says how it is drawn on the map: a box
// has a middle and a size, a line has points, and a point has a middle.
export const SIDES = ["north", "east", "south", "west"];

// The water level belongs to the zone, not the recipe, and stays after the
// terrain is locked in.
export const WATER = { key: "water", label: "Water level", unit: "m", min: -10, max: 30, step: 0.5, value: -1 };

export const EDGES =
{
    none: { label: "None", settings: [] },
    cliffs:
    {
        label: "Cliffs",
        settings:
        [
            { key: "band", label: "Band", unit: "m", min: 20, max: 120, step: 5, value: 60 },
            { key: "height", label: "Height", unit: "m", min: 6, max: 40, step: 1, value: 28 },
            { key: "foot", label: "Foot slope", unit: "m", min: 0, max: 12, step: 0.5, value: 4, detail: "How high a gentle slope of earth and grass rises at the cliffs' foot before the rock face" },
        ],
    },
    water:
    {
        label: "Deep water",
        settings:
        [
            { key: "band", label: "Band", unit: "m", min: 20, max: 200, step: 5, value: 100 },
        ],
    },
};

const WIDTH = { key: "width", label: "Width", unit: "m", min: 8, max: 600, step: 2, value: 160 };
const LENGTH = { key: "length", label: "Length", unit: "m", min: 8, max: 600, step: 2, value: 100 };
const HILLY_HEIGHT = { key: "height", label: "Hill height", unit: "m", min: 1, max: 40, step: 0.5, value: 10, detail: "Added from valley floor to hilltop, centred on the ground already there" };
const HILLY_SIZE = { key: "size", label: "Hill size", unit: "m", min: 20, max: 300, step: 5, value: 60, detail: "The usual distance from one hill to the next" };

export const FEATURES =
{
    flat:
    {
        label: "Flat area",
        shape: "box",
        settings:
        [
            WIDTH,
            LENGTH,
            { key: "level", label: "Height", choices: [["ground", "Match the ground"], ["water", "Above the water"]], value: "ground" },
            { key: "height", label: "Above water", unit: "m", min: 0, max: 30, step: 0.5, value: 1.5, when: ["level", "water"] },
            { key: "blend", label: "Blend", unit: "m", min: 0, max: 100, step: 2, value: 40 },
            { key: "roll", label: "Roll", unit: "m", min: 0, max: 3, step: 0.1, value: 0.5 },
        ],
    },
    basin:
    {
        label: "Basin",
        shape: "box",
        settings:
        [
            WIDTH,
            LENGTH,
            { key: "floor", label: "Type", choices: [["water", "Lake"], ["ground", "Hollow"]], value: "water" },
            { key: "drop", label: "Depth", unit: "m", min: 0.5, max: 40, step: 0.5, value: 4 },
            { key: "blend", label: "Blend", unit: "m", min: 0, max: 150, step: 2, value: 40 },
        ],
    },
    rise:
    {
        label: "Rise",
        shape: "box",
        settings:
        [
            WIDTH,
            LENGTH,
            { key: "height", label: "Height", unit: "m", min: 0.5, max: 40, step: 0.5, value: 8 },
            { key: "blend", label: "Blend", unit: "m", min: 0, max: 150, step: 2, value: 20 },
        ],
    },
    hilly:
    {
        label: "Hilly area",
        shape: "box",
        settings:
        [
            WIDTH,
            LENGTH,
            HILLY_HEIGHT,
            HILLY_SIZE,
            { key: "blend", label: "Blend", unit: "m", min: 0, max: 150, step: 2, value: 40 },
        ],
    },
    hillyBand:
    {
        label: "Hilly band",
        shape: "line",
        settings:
        [
            { key: "width", label: "Width", unit: "m", min: 10, max: 300, step: 2, value: 60 },
            HILLY_HEIGHT,
            HILLY_SIZE,
            { key: "blend", label: "Blend", unit: "m", min: 0, max: 150, step: 2, value: 30 },
        ],
    },
    river:
    {
        label: "River",
        shape: "line",
        settings:
        [
            { key: "width", label: "Width", unit: "m", min: 2, max: 40, step: 1, value: 8 },
            { key: "valley", label: "Valley", unit: "m", min: 0, max: 100, step: 2, value: 30 },
            { key: "start", label: "Start", choices: [["none", "Open"], ["waterfall", "Waterfall"]], value: "none" },
            { key: "end", label: "End", choices: [["none", "Open"], ["arch", "Under the cliff"], ["gorge", "Bending gorge"]], value: "none" },
        ],
    },
    pass:
    {
        label: "Pass",
        shape: "point",
        settings:
        [
            { key: "width", label: "Width", unit: "m", min: 4, max: 30, step: 1, value: 10 },
        ],
    },
};

// What the editor's terrain panel needs to build its fields.
export function kinds()
{
    const describe = (table) => Object.fromEntries(Object.entries(table).map(([kind, { label, shape, settings }]) => [kind, { label, shape, settings }]));

    return { water: WATER, sides: SIDES, bases: describe(Bases.BASES), edges: describe(EDGES), features: describe(FEATURES) };
}

export function defaultsOf(settings)
{
    return Object.fromEntries(settings.map((setting) => [setting.key, setting.value]));
}

export function starter()
{
    return {
        base: { kind: "hills", ...defaultsOf(Bases.BASES.hills.settings) },
        edges: Object.fromEntries(SIDES.map((side) => [side, { kind: "cliffs", ...defaultsOf(EDGES.cliffs.settings) }])),
        features: [],
    };
}


/******************************************************************************/
/* CHECK                                                                      */
/******************************************************************************/

// The problems with a recipe for a zone `size` metres across, as sentences.
export function check(recipe, size)
{
    const problems = [];
    const half = size / 2;

    if(!isObject(recipe)) { return ["The terrain recipe needs to be an object."]; }

    if(!isObject(recipe.base) || !Bases.BASES[recipe.base.kind]) { problems.push("The terrain needs a base, one of " + Object.keys(Bases.BASES).join(", ") + "."); }
    else { checkSettings(Bases.BASES[recipe.base.kind], recipe.base, "The base", problems); }

    for(const side of SIDES)
    {
        const edge = recipe.edges?.[side];

        if(!isObject(edge) || !EDGES[edge.kind]) { problems.push("The " + side + " edge needs a kind, one of " + Object.keys(EDGES).join(", ") + "."); }
        else { checkSettings(EDGES[edge.kind], edge, "The " + side + " edge", problems); }
    }

    if(!Array.isArray(recipe.features)) { problems.push("The terrain needs a list of features."); return problems; }

    recipe.features.forEach((feature, i) => checkFeature(feature, "Feature " + (i + 1), half, problems));

    return problems;
}

function checkFeature(feature, where, half, problems)
{
    const kind = isObject(feature) ? FEATURES[feature.kind] : null;
    const isInside = (point) => Array.isArray(point) && point.length === 2 && point.every((value) => Number.isFinite(value) && Math.abs(value) <= half);

    if(!kind) { problems.push(where + " needs a kind, one of " + Object.keys(FEATURES).join(", ") + "."); return; }

    checkSettings(kind, feature, where, problems);

    if(kind.shape === "line" && !(Array.isArray(feature.points) && feature.points.length >= 2 && feature.points.every(isInside))) { problems.push(where + " needs two or more points inside the zone."); }
    if(kind.shape !== "line" && !isInside([feature.x, feature.z])) { problems.push(where + " needs a middle inside the zone."); }
}

function checkSettings(kind, values, where, problems)
{
    for(const setting of kind.settings.filter((setting) => isApplied(setting, values))) { checkSetting(setting, values[setting.key], where + "'s " + setting.label.toLowerCase(), problems); }
}

function checkSetting(setting, value, name, problems)
{
    if(setting.choices)
    {
        if(!setting.choices.some(([choice]) => choice === value)) { problems.push(name + " needs to be one of " + setting.choices.map(([choice]) => choice).join(", ") + "."); }

        return;
    }

    if(!(Number.isFinite(value) && value >= setting.min && value <= setting.max)) { problems.push(name + " needs to be a number from " + setting.min + " to " + setting.max + "."); }
}

export function isApplied(setting, values)
{
    return !setting.when || values[setting.when[0]] === setting.when[1];
}

function isObject(value)
{
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
