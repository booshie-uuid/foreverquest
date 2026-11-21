export const SIDES = ["front", "back", "left", "right"];
export const LINEN = "#7a705c";
export const SOLE = "#1e1a16";

// Tails hang from each leg under a long garment, with a dark hem. A length
// that is a sum needs its centre, 0.5 minus half the length, as a sum too.
export function tails(stamp, length, centre = 0.5 - length / 2)
{
    return {
        at: "legL",
        mirror: "legR",
        size: ["leg.w + 1.6", length, "leg.d + 1.6"],
        centre: [0, centre, 0],
        faces: { top: [{ stamp, tint: "primary" }], all: [{ stamp, tint: "primary" }, { stamp: "hem", place: "tile bottom", tint: "primary" }] },
    };
}
