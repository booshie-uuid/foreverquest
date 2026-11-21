function marking(id, name, tint)
{
    return { id, slot: "markings", name, paint: [{ region: "face", stamp: "marking." + id, place: "centre centre", ...(tint ? { tint } : {}) }] };
}

const MARKINGS =
[
    { id: "none", slot: "markings", name: "None" },
    marking("scar", "Scar", { of: "skin", mix: "#d8a8a0", amount: 0.5 }),
    marking("weathered", "Weathered", "skin"),
    marking("warpaint", "War Paint"),
    marking("tattoo", "Tattoo"),
];

export const PARTS = MARKINGS.map((part, order) => ({ ...part, order }));
