export const PART =
{
    id: "1",
    slot: "face",
    paint:
    [
        { region: "face", stamp: "face.1.brows", place: "centre centre", tint: { of: "hair", shade: 0.75 } },
        { region: "face", stamp: "eyes.1", place: "centre centre", tint: "eyes" },
        { region: "face", stamp: "lids", place: "centre centre", tint: { of: "skin", shade: 0.55 }, variants: ["male"] },
        { region: "face", stamp: "lids", place: "centre centre", tint: "#1e1612", variants: ["female"] },
        { region: "face", stamp: "face.1.skin", place: "centre centre", tint: "skin" },
        { region: "face", stamp: "face.1.mouth", place: "centre centre", tint: { of: "skin", shade: 0.6 }, variants: ["male"] },
        { region: "face", stamp: "face.1.mouth", place: "centre centre", tint: { of: "skin", mix: "#6a2a2a", amount: 0.45 }, variants: ["female"] },
    ],
};
