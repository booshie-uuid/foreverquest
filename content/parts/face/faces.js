import * as Head from "../../stamps/head.js";

const FACE = { region: "face", place: "centre centre" };

function face(id, shape, order)
{
    return {
        id,
        slot: "face",
        name: shape.name,
        order,
        paint:
        [
            { ...FACE, stamp: "face." + id + ".brows", tint: { of: "hair", shade: 0.75 } },
            { ...FACE, stamp: "eyes." + shape.eyes, tint: "eyes" },
            { ...FACE, stamp: shape.lashes ? "lids.lashes" : "lids", tint: { of: "skin", shade: 0.55 }, variants: ["male"] },
            { ...FACE, stamp: shape.lashes ? "lids.lashes" : "lids", tint: "#1e1612", variants: ["female"] },
            { ...FACE, stamp: "face." + id + ".skin", tint: "skin" },
            ...(shape.cheeks ? [{ ...FACE, stamp: "cheeks", tint: { of: "skin", mix: "#b0504a", amount: 0.22 } }] : []),
            { ...FACE, stamp: "face." + id + ".mouth", tint: { of: "skin", shade: 0.6 }, variants: ["male"] },
            { ...FACE, stamp: "face." + id + ".mouth", tint: { of: "skin", mix: "#6a2a2a", amount: 0.45 }, variants: ["female"] },
        ],
    };
}

export const PARTS = Object.entries(Head.FACES).map(([id, shape], order) => face(id, shape, order));
