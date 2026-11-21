function marking(id, tint)
{
    return { id, slot: "markings", paint: [{ region: "face", stamp: "marking." + id, place: "centre centre", ...(tint ? { tint } : {}) }] };
}

export const PARTS =
[
    { id: "none", slot: "markings" },
    marking("scar", { of: "skin", mix: "#d8a8a0", amount: 0.5 }),
    marking("weathered", "skin"),
    marking("warpaint"),
    marking("tattoo"),
];
