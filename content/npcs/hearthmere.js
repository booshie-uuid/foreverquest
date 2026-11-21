const RESIDENTS =
[
    {
        lines: ["Keep your blade sheathed in the square, {name}.", "Wolves took two sheep from the north field. Or something did.", "The gibbet stays empty while I hold this post."],
        look:
        {
            name: "Aldric", body: "human", variant: "male", face: "1", hair: "crop", hairColour: "#2b2119", beard: "stubble", skin: "#a5785e", markings: "scar",
            equipment: { head: { item: "kettle" }, chest: { item: "plate", trim: "#1e2430" }, legs: { item: "greaves" }, feet: { item: "sabatons" }, hands: { item: "gauntlets" }, back: { item: "cape", colour: "#1e2430" }, mainHand: { item: "sword" }, offHand: { item: "heater", colour: "#1e2430", trim: "#9a917c" } },
        },
    },
    {
        role: "tailor",
        lines: ["You look half-dead, {name}. Let me find you something better to wear."],
        look:
        {
            name: "Mirelle", body: "human", variant: "female", face: "5", hair: "topknot", hairColour: "#7a3a22", beard: "none", skin: "#c8ab94", eyes: "#3d4a3a",
            equipment: { head: { item: "none" }, chest: { item: "tunic", colour: "#3a2a40", trim: "#2e241c" }, legs: { item: "trousers", colour: "#2e241c" }, feet: { item: "shoes" }, hands: { item: "none" }, back: { item: "none" }, mainHand: { item: "none" }, offHand: { item: "none" } },
        },
    },
    {
        lines: ["The dead here do not rest easily, {name}.", "Light a candle at the chapel if you mean to walk north.", "I tend the graves. Someone must."],
        look:
        {
            name: "Ilyra", body: "elf", variant: "female", face: "3", hair: "long", hairColour: "#d4d0c6", beard: "none", skin: "#9a9aa4", eyes: "#5e605a", nose: "long",
            equipment: { head: { item: "hood", colour: "#16161a" }, chest: { item: "robe", colour: "#16161a", trim: "#4a1a18" }, legs: { item: "trousers", colour: "#16161a" }, feet: { item: "shoes" }, hands: { item: "none" }, back: { item: "none" }, mainHand: { item: "staff" }, offHand: { item: "lantern" } },
        },
    },
    {
        lines: ["Iron does not lie, {name}. People do.", "Bring me ore and I'll make you something that lasts.", "My beard's seen three wars. Your face has seen one breakfast."],
        look:
        {
            name: "Brom", body: "dwarf", variant: "male", face: "4", hair: "bald", hairColour: "#7a3a22", beard: "forked", nose: "broad", skin: "#a07a62", markings: "tattoo",
            equipment: { head: { item: "horned" }, chest: { item: "jerkin" }, legs: { item: "trousers", colour: "#2e241c" }, feet: { item: "boots" }, hands: { item: "gloves" }, back: { item: "none" }, mainHand: { item: "axe" }, offHand: { item: "buckler" } },
        },
    },
    {
        lines: ["Grukk was paid to watch the road. Grukk watches.", "You smell of soap. Suspicious.", "The dwarf owes Grukk three silver."],
        look:
        {
            name: "Grukk", body: "orc", variant: "male", face: "6", hair: "crest", hairColour: "#17130f", beard: "none", skin: "#56664a", eyes: "#6a2a2a", markings: "warpaint",
            equipment: { head: { item: "none" }, chest: { item: "mail" }, legs: { item: "trousers", colour: "#2e241c" }, feet: { item: "boots" }, hands: { item: "gloves" }, back: { item: "cloak", colour: "#2e241c" }, mainHand: { item: "mace" }, offHand: { item: "none" } },
        },
    },
    {
        lines: ["Don't tell the baker you saw me, {name}.", "Lost my boots in the bog. Better them than me.", "There are lights on the lake at night. Nobody goes out there."],
        look:
        {
            name: "Pip", body: "halfling", variant: "male", face: "5", hair: "swept", hairColour: "#5a3c24", beard: "none", skin: "#b49a84", nose: "small",
            equipment: { head: { item: "none" }, chest: { item: "shirt", colour: "#6a5a3a" }, legs: { item: "breeches", colour: "#3e4a2a" }, feet: { item: "none" }, hands: { item: "none" }, back: { item: "pack" }, mainHand: { item: "none" }, offHand: { item: "none" } },
        },
    },
    {
        lines: ["Have you seen anything unnatural on the road, {name}?", "Every village has its secrets. I find them.", "Stay out of the old forest after dark."],
        look:
        {
            name: "Osric", body: "human", variant: "male", face: "6", hair: "crop", hairColour: "#17130f", beard: "short", skin: "#c8ab94", eyes: "#2a2420",
            equipment: { head: { item: "brimmed" }, chest: { item: "coat" }, legs: { item: "trousers", colour: "#16161a" }, feet: { item: "boots" }, hands: { item: "gloves", colour: "#2e241c" }, back: { item: "none" }, mainHand: { item: "sword" }, offHand: { item: "lantern" } },
        },
    },
];

const VILLAGER_LINES =
[
    "Keep moving, {name}.",
    "Bad harvest again. Worse winter coming.",
    "Don't drink the well water after dark.",
    "They say the lake takes one a year.",
    "Pray at the chapel if you've coin for the priest.",
];

// Zones give each resident a home and a roaming distance.
export const NPCS = Object.fromEntries(RESIDENTS.map(({ look, lines, role }) => [look.name.toLowerCase(), { name: look.name, lines, role: role ?? null, look }]));

export const LINES = { villager: VILLAGER_LINES };
