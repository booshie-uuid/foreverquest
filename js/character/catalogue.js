

/******************************************************************************/
/* PALETTES                                                                   */
/******************************************************************************/

export const HAIR_COLOURS =
[
    "#17130f", "#2b2119", "#3f2c1e", "#5a3c24", "#6e4a2a", "#7a3a22",
    "#8a6a44", "#a08a62", "#6e6a64", "#a6a29a", "#d4d0c6",
];

export const EYE_COLOURS =
[
    "#2b3a4a", "#3d4a3a", "#4a3a2a", "#2a2420", "#5e605a", "#7a6a30", "#6a2a2a",
];

export const CLOTH_COLOURS =
[
    "#4a1a18", "#5e2a1e", "#6a5a3a", "#7a705c", "#9a917c", "#3e4a2a",
    "#24301f", "#2a3640", "#1e2430", "#3a2a40", "#4a3424", "#2e241c",
    "#5a5246", "#2a2a2a", "#16161a",
];

export const METAL_COLOURS =
[
    "#7a7e85", "#9a9ea4", "#4a4e56", "#2e3034", "#7a5a34", "#8a7240", "#6a4a34",
];

export const PALETTES =
{
    cloth: CLOTH_COLOURS,
    metal: METAL_COLOURS,
};


/******************************************************************************/
/* FACES AND HAIR                                                             */
/******************************************************************************/

export const FACES =
[
    { id: "1", name: "Stern", brow: 0, eyes: 1, lines: 0, mouth: 0 },
    { id: "2", name: "Weary", brow: 1, eyes: 1, lines: 1, mouth: 0 },
    { id: "3", name: "Gaunt", brow: 0, eyes: 1, lines: 2, mouth: 1 },
    { id: "4", name: "Broad", brow: -1, eyes: 1, lines: 0, mouth: 2 },
    { id: "5", name: "Young", brow: 1, eyes: 2, lines: 0, mouth: 0 },
    { id: "6", name: "Grim", brow: -1, eyes: 1, lines: 1, mouth: 1 },
];

export const NOSES =
[
    { id: "straight", name: "Straight", size: [2, 4, 1] },
    { id: "small", name: "Small", size: [2, 2, 1] },
    { id: "broad", name: "Broad", size: [4, 3, 1] },
    { id: "hooked", name: "Hooked", size: [2, 5, 2] },
    { id: "long", name: "Long", size: [2, 4, 3] },
];

export const HAIR_STYLES =
[
    { id: "bald", name: "Bald" },
    { id: "shaved", name: "Shaved" },
    { id: "crop", name: "Cropped" },
    { id: "swept", name: "Swept" },
    { id: "long", name: "Long" },
    { id: "tail", name: "Tail" },
    { id: "braids", name: "Braids" },
    { id: "topknot", name: "Topknot" },
    { id: "crest", name: "Crest" },
];

export const BEARD_STYLES =
[
    { id: "none", name: "None" },
    { id: "stubble", name: "Stubble" },
    { id: "moustache", name: "Moustache" },
    { id: "short", name: "Short" },
    { id: "full", name: "Full" },
    { id: "long", name: "Long" },
    { id: "forked", name: "Forked" },
];

export const MARKINGS =
[
    { id: "none", name: "None" },
    { id: "scar", name: "Scar" },
    { id: "weathered", name: "Weathered" },
    { id: "warpaint", name: "War Paint" },
    { id: "tattoo", name: "Tattoo" },
];


/******************************************************************************/
/* EQUIPMENT                                                                  */
/******************************************************************************/

export const SLOTS =
[
    { id: "head", name: "Head" },
    { id: "chest", name: "Chest" },
    { id: "legs", name: "Legs" },
    { id: "feet", name: "Feet" },
    { id: "hands", name: "Hands" },
    { id: "back", name: "Back" },
    { id: "mainHand", name: "Main Hand" },
    { id: "offHand", name: "Off Hand" },
];

const NONE = { id: "none", name: "None", primary: null, trim: null };

export const EQUIPMENT =
{
    head:
    [
        NONE,
        { id: "hood", name: "Hood", primary: "cloth", trim: null, colour: "#24261f", hidesHair: true },
        { id: "coif", name: "Mail Coif", primary: "metal", trim: null, colour: "#7a7e85", hidesHair: true },
        { id: "kettle", name: "Kettle Hat", primary: "metal", trim: null, colour: "#7a7e85", hidesHair: false },
        { id: "helm", name: "Great Helm", primary: "metal", trim: "metal", colour: "#4a4e56", trimColour: "#8a7240", hidesHair: true, hidesFace: true },
        { id: "horned", name: "Horned Helm", primary: "metal", trim: "cloth", colour: "#4a4e56", trimColour: "#9a917c", hidesHair: true },
        { id: "brimmed", name: "Brimmed Hat", primary: "cloth", trim: "cloth", colour: "#16161a", trimColour: "#4a3424", hidesHair: false },
        { id: "circlet", name: "Circlet", primary: "metal", trim: "cloth", colour: "#8a7240", trimColour: "#4a1a18", hidesHair: false },
    ],
    chest:
    [
        { id: "none", name: "None", primary: null, trim: null },
        { id: "shirt", name: "Shirt", primary: "cloth", trim: null, colour: "#7a705c" },
        { id: "tunic", name: "Tunic", primary: "cloth", trim: "cloth", colour: "#3e4a2a", trimColour: "#4a3424" },
        { id: "robe", name: "Robe", primary: "cloth", trim: "cloth", colour: "#2a2a2a", trimColour: "#4a1a18" },
        { id: "jerkin", name: "Leather Jerkin", primary: "cloth", trim: "cloth", colour: "#4a3424", trimColour: "#2e241c" },
        { id: "coat", name: "Long Coat", primary: "cloth", trim: "metal", colour: "#16161a", trimColour: "#8a7240" },
        { id: "mail", name: "Mail Hauberk", primary: "metal", trim: "cloth", colour: "#7a7e85", trimColour: "#2e241c" },
        { id: "plate", name: "Plate and Tabard", primary: "metal", trim: "cloth", colour: "#7a7e85", trimColour: "#4a1a18" },
    ],
    legs:
    [
        NONE,
        { id: "trousers", name: "Trousers", primary: "cloth", trim: null, colour: "#2e241c" },
        { id: "breeches", name: "Breeches", primary: "cloth", trim: null, colour: "#5a5246" },
        { id: "greaves", name: "Greaves", primary: "metal", trim: "cloth", colour: "#7a7e85", trimColour: "#2a2a2a" },
    ],
    feet:
    [
        NONE,
        { id: "shoes", name: "Shoes", primary: "cloth", trim: null, colour: "#2e241c" },
        { id: "boots", name: "Tall Boots", primary: "cloth", trim: null, colour: "#2e241c" },
        { id: "sabatons", name: "Sabatons", primary: "metal", trim: null, colour: "#7a7e85" },
    ],
    hands:
    [
        NONE,
        { id: "gloves", name: "Gloves", primary: "cloth", trim: null, colour: "#4a3424" },
        { id: "gauntlets", name: "Gauntlets", primary: "metal", trim: null, colour: "#7a7e85" },
    ],
    back:
    [
        NONE,
        { id: "cape", name: "Cape", primary: "cloth", trim: null, colour: "#4a1a18" },
        { id: "cloak", name: "Ragged Cloak", primary: "cloth", trim: null, colour: "#24301f" },
        { id: "pack", name: "Pack", primary: "cloth", trim: "cloth", colour: "#4a3424", trimColour: "#6a5a3a" },
    ],
    mainHand:
    [
        NONE,
        { id: "sword", name: "Sword", primary: "metal", trim: "cloth", colour: "#9a9ea4", trimColour: "#2e241c" },
        { id: "axe", name: "Axe", primary: "metal", trim: "cloth", colour: "#7a7e85", trimColour: "#4a3424" },
        { id: "mace", name: "Mace", primary: "metal", trim: "cloth", colour: "#4a4e56", trimColour: "#2e241c" },
        { id: "spear", name: "Spear", primary: "metal", trim: "cloth", colour: "#7a7e85", trimColour: "#4a3424" },
        { id: "staff", name: "Staff", primary: "cloth", trim: "metal", colour: "#2e241c", trimColour: "#8a7240" },
        { id: "pitchfork", name: "Pitchfork", primary: "cloth", trim: "metal", colour: "#4a3424", trimColour: "#4a4e56" },
    ],
    offHand:
    [
        NONE,
        { id: "buckler", name: "Buckler", primary: "metal", trim: "metal", colour: "#4a4e56", trimColour: "#7a7e85" },
        { id: "heater", name: "Heater Shield", primary: "cloth", trim: "cloth", colour: "#4a1a18", trimColour: "#9a917c" },
        { id: "lantern", name: "Lantern", primary: "metal", trim: null, colour: "#2e3034" },
        { id: "dagger", name: "Dagger", primary: "metal", trim: "cloth", colour: "#9a9ea4", trimColour: "#2e241c" },
    ],
};

export const ARCHETYPES =
[
    {
        id: "villager",
        slots: { head: ["none", "none", "hood"], chest: ["shirt", "tunic"], legs: ["trousers", "breeches"], feet: ["shoes", "boots", "none"], hands: ["none"], back: ["none", "none", "pack"], mainHand: ["none", "none", "pitchfork"], offHand: ["none"] },
    },
    {
        id: "guard",
        slots: { head: ["kettle", "coif", "helm"], chest: ["mail", "plate"], legs: ["greaves", "trousers"], feet: ["sabatons", "boots"], hands: ["gauntlets", "gloves"], back: ["cape", "none"], mainHand: ["sword", "spear", "mace"], offHand: ["heater", "buckler", "none"] },
    },
    {
        id: "hunter",
        slots: { head: ["hood", "none"], chest: ["jerkin", "tunic"], legs: ["trousers"], feet: ["boots"], hands: ["gloves"], back: ["cloak", "pack"], mainHand: ["axe", "spear"], offHand: ["dagger", "none"] },
    },
    {
        id: "zealot",
        slots: { head: ["brimmed", "hood", "none"], chest: ["coat", "robe"], legs: ["trousers"], feet: ["boots"], hands: ["gloves", "none"], back: ["none", "cloak"], mainHand: ["staff", "sword", "none"], offHand: ["lantern", "none"] },
    },
];


/******************************************************************************/
/* LOOKUP                                                                     */
/******************************************************************************/

export function find(list, id)
{
    return list.find((entry) => entry.id === id) ?? null;
}

export function item(slot, id)
{
    return find(EQUIPMENT[slot] ?? [], id);
}
