export const DEFAULTS =
{
    name: "Adventurer",
    body: "human",
    variant: "male",
    skin: "#b49a84",
    face: "1",
    nose: "straight",
    eyes: "#2b3a4a",
    hair: "crop",
    hairColour: "#3f2c1e",
    beard: "stubble",
    markings: "none",
    equipment: { head: "none", chest: "jerkin", legs: "trousers", feet: "boots", hands: "gloves", back: "cloak", mainHand: "sword", offHand: "none" },
};

// A body may replace the beard rule with its own `random.beard`. Random gear
// favours two random cloth colours, the favoured colours, and one of the first
// `favouredMetals` metal colours.
export const RANDOM =
{
    hair: { female: ["long", "tail", "braids", "topknot", "swept"], male: ["crop", "swept", "bald", "shaved", "crest", "tail", "long"] },
    beard: { odds: 0.55, from: ["stubble", "stubble", "moustache", "short", "full", "long"], variants: ["male"] },
    markings: { odds: 0.35 },
    favouredColours: ["#4a3424", "#2e241c"],
    favouredMetals: 4,
};
