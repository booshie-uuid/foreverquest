// A piece is a prefab or an object; a prefab variant such as `pine.3` takes
// the entry of `pine`. A block of kind "object" needs no type, as the palette
// never lists it.
export const BLOCK_TYPES =
{
    ground: { label: "Ground", ids: ["grass", "moss", "earth", "mud", "sand", "cobble", "rock", "water"] },
    stone: { label: "Stone", ids: ["stone", "rubble", "slab", "slate", "plaster", "pottery", "glaze"] },
    wood: { label: "Wood", ids: ["timber", "planks", "oldPlanks", "bark", "thatch", "polishedWood", "wicker"] },
    metal: { label: "Metal", ids: ["iron", "steel", "pewter", "brass"] },
    glass: { label: "Glass", ids: ["window", "clearGlass", "leadedGlass", "stainedGlass", "grimyGlass", "glassGreen", "glassBrown"] },
    cloth: { label: "Cloth", ids: ["sacking", "banner", "linen", "leather", "parchment", "print"] },
    plants: { label: "Plants", ids: ["needles", "leaves", "petalRed", "petalYellow", "petalWhite", "petalBlue", "apple"] },
    light: { label: "Light", ids: ["embers", "wax"] },
};

export const PIECE_TYPES =
{
    furniture: { label: "Furniture", ids: ["bed", "bench", "pew", "stool", "table", "shelf", "lectern", "books", "banner", "runner"] },
    storage: { label: "Storage", ids: ["barrel", "chest", "crate", "crateLarge", "crateSmall", "crate70", "crate65", "crate55", "crate50", "sacks", "cart"] },
    kitchen: { label: "Kitchen", ids: ["bottles", "bowl", "jug", "mugs"] },
    lighting: { label: "Lighting", ids: ["candelabra", "candlestick", "chandelier", "lantern", "lampPost", "sconce"] },
    faith: { label: "Faith", ids: ["altar", "cross"] },
    mechanisms: { label: "Mechanisms", ids: ["leverBase", "leverHandle", "liftPlatform", "lockedDoor", "millWheel", "portcullis"] },
    plants: { label: "Plants", ids: ["flowerBed", "flowerPot", "poppies", "wildflowers", "pine", "oak", "deadTree", "bush", "weeds", "rock"] },
    structures:
    {
        label: "Structures",
        ids:
        [
            "well", "stocks", "signpost", "gibbet", "grave", "chapel", "archway", "bridge", "landing", "pedestal", "cottage", "house",
            "townhouse", "inn", "store", "smithy", "warehouse", "stable", "gatehouse", "watchtower", "mill", "barn",
        ],
    },
};

// Every block and piece not listed under another pack is in the core pack.
export const PACKS =
{
    core: { label: "Core" },
    hearthmere:
    {
        label: "Hearthmere",
        blocks: ["glassGreen", "glassBrown", "glaze", "pewter", "brass", "polishedWood", "leather", "parchment", "print", "wax", "wicker"],
        pieces: ["bottles", "jug", "bowl", "books", "candlestick"],
    },
};
