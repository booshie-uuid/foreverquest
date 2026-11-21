import * as Catalogue from "./catalogue.js";
import * as Face from "../art/face.js";
import * as Pixels from "../art/pixels.js";

const LINEN = "#7a705c";
const HOSE = "#4a443a";
const SIDES = ["front", "back", "left", "right"];
const FACES = [...SIDES, "top", "bottom"];
const LIMBS = ["armL", "armR", "legL", "legR"];
const PARTS = ["head", "torso", ...LIMBS];
const HAND_ROWS = 5;

// Painters run in the order they are added, so each later layer paints over
// the earlier ones.
export function layers(look, dims)
{
    const result = {};

    for(const part of PARTS) { result[part] = Object.fromEntries(FACES.map((face) => [face, []])); }

    const add = (parts, faces, painter) =>
    {
        for(const part of parts) { for(const face of faces) { result[part][face].push(painter); } }
    };

    const skin = look.get("skin");

    add(PARTS, FACES, material("grit", skin));
    paintHead(add, look);
    paintLegs(add, look, dims);
    paintFeet(add, look);
    paintChest(add, look, dims);
    paintHands(add, look);

    return result;
}

export function material(kind, colour)
{
    if(kind === "grit") { return (raster, area, random) => Pixels.grit(raster, area, colour, random, 0.08); }

    return (raster, area, random) => Pixels[kind](raster, area, random, colour);
}

function band(from, count, painter)
{
    return (raster, area, random, glow) => painter(raster, Pixels.rows(area, from, count), random, glow);
}

function strip(from, count, painter)
{
    return (raster, area, random, glow) => painter(raster, Pixels.columns(area, from, count), random, glow);
}

function surfaceOf(slot, gear)
{
    const item = Catalogue.item(slot, gear.item);

    return item?.primary === "metal" ? "plate" : "cloth";
}


/******************************************************************************/
/* HEAD                                                                       */
/******************************************************************************/

function paintHead(add, look)
{
    const face =
    {
        skin: look.get("skin"),
        hairColour: look.get("hairColour"),
        eyes: look.get("eyes"),
        face: Catalogue.find(Catalogue.FACES, look.get("face")),
        beard: look.get("beard"),
        markings: look.get("markings"),
        hair: look.get("hair"),
        isFemale: look.get("variant") === "female",
    };

    add(["head"], ["front"], (raster, area, random) => Face.front(raster, area, random, face));

    for(const side of ["top", "back", "left", "right"])
    {
        add(["head"], [side], (raster, area, random) => Face.hair(raster, area, random, side, face.hair, face.hairColour));
    }
}


/******************************************************************************/
/* LEGS AND FEET                                                              */
/******************************************************************************/

function paintLegs(add, look, dims)
{
    const gear = look.equipped("legs");
    const legs = ["legL", "legR"];
    const height = dims.leg[1];

    switch(gear.item)
    {
        case "trousers":
            add(legs, [...SIDES, "top"], material("cloth", gear.colour));
            break;
        case "breeches":
            add(legs, SIDES, band(0, Math.round(height * 0.55), material("cloth", gear.colour)));
            add(legs, SIDES, band(Math.round(height * 0.55), height, material("cloth", HOSE)));
            add(legs, ["top"], material("cloth", gear.colour));
            break;
        case "greaves":
            add(legs, [...SIDES, "top"], material("cloth", gear.trim));
            add(legs, SIDES, band(Math.round(height * 0.38), height, material("plate", gear.colour)));
            add(legs, ["front"], band(Math.round(height * 0.38), 3, material("plate", Pixels.shade(gear.colour, 1.25))));
            break;
        default:
            add(legs, SIDES, band(0, 6, material("cloth", LINEN)));
    }
}

function paintFeet(add, look)
{
    const gear = look.equipped("feet");
    const legs = ["legL", "legR"];
    const sole = material("leather", "#1e1a16");

    switch(gear.item)
    {
        case "shoes":
            add(legs, SIDES, band(-5, 5, material("leather", gear.colour)));
            add(legs, ["bottom"], sole);
            break;
        case "boots":
            add(legs, SIDES, band(-16, 16, material("leather", gear.colour)));
            add(legs, SIDES, band(-16, 2, material("leather", Pixels.shade(gear.colour, 1.3))));
            add(legs, ["bottom"], sole);
            break;
        case "sabatons":
            add(legs, SIDES, band(-9, 9, material("plate", gear.colour)));
            add(legs, ["bottom"], material("plate", Pixels.shade(gear.colour, 0.6)));
            break;
        default:
            add(legs, ["bottom"], material("grit", Pixels.shade(look.get("skin"), 0.6)));
    }
}


/******************************************************************************/
/* CHEST AND HANDS                                                            */
/******************************************************************************/

function paintChest(add, look, dims)
{
    const gear = look.equipped("chest");
    const arms = ["armL", "armR"];
    const torso = ["torso"];
    const armHeight = dims.arm[1];
    const sleeve = armHeight - HAND_ROWS;
    const belt = (colour) => band(-6, 2, material("leather", colour));

    switch(gear.item)
    {
        case "shirt":
            add(torso, FACES, material("cloth", gear.colour));
            add(arms, SIDES, band(0, 12, material("cloth", gear.colour)));
            add(arms, ["top"], material("cloth", gear.colour));
            add(torso, ["front"], neckline(look.get("skin")));
            break;
        case "tunic":
            add(torso, FACES, material("cloth", gear.colour));
            add(arms, SIDES, band(0, sleeve, material("cloth", gear.colour)));
            add(arms, ["top"], material("cloth", gear.colour));
            add(torso, SIDES, belt(gear.trim));
            break;
        case "robe":
            add(torso, FACES, material("cloth", gear.colour));
            add(arms, SIDES, band(0, sleeve, material("cloth", gear.colour)));
            add(arms, SIDES, band(sleeve - 3, 3, material("cloth", gear.trim)));
            add(arms, ["top"], material("cloth", gear.colour));
            add(torso, SIDES, band(0, 3, material("cloth", gear.trim)));
            add(torso, SIDES, band(-9, 3, material("cloth", gear.trim)));
            break;
        case "jerkin":
            add(torso, FACES, material("cloth", LINEN));
            add(torso, FACES, material("leather", gear.colour));
            add(arms, SIDES, band(0, sleeve, material("cloth", LINEN)));
            add(arms, SIDES, band(0, 10, material("leather", gear.colour)));
            add(arms, ["top"], material("leather", gear.colour));
            add(torso, ["front"], straps(gear.trim));
            add(torso, SIDES, belt(gear.trim));
            break;
        case "coat":
            add(torso, FACES, material("leather", gear.colour));
            add(arms, SIDES, band(0, sleeve, material("leather", gear.colour)));
            add(arms, ["top"], material("leather", gear.colour));
            add(torso, ["front"], buttons(gear.trim));
            add(torso, SIDES, band(0, 3, material("leather", Pixels.shade(gear.colour, 1.4))));
            break;
        case "mail":
            add(torso, FACES, material("chain", gear.colour));
            add(arms, SIDES, band(0, sleeve, material("chain", gear.colour)));
            add(arms, ["top"], material("chain", gear.colour));
            add(torso, SIDES, belt(gear.trim));
            break;
        case "plate":
            add(torso, FACES, material("chain", gear.colour));
            add(torso, FACES, band(0, dims.torso[1] - 6, material("plate", gear.colour)));
            add(arms, SIDES, band(0, sleeve, material("chain", gear.colour)));
            add(arms, SIDES, band(0, 9, material("plate", gear.colour)));
            add(arms, ["top"], material("plate", gear.colour));
            add(torso, ["front", "back"], tabard(gear.trim, dims.torso[0]));
            add(torso, SIDES, belt("#2a1e16"));
            break;
        default:
            if(look.get("variant") === "female") { add(torso, SIDES, band(5, 9, material("cloth", LINEN))); }
    }
}

function paintHands(add, look)
{
    const gear = look.equipped("hands");
    const arms = ["armL", "armR"];

    switch(gear.item)
    {
        case "gloves":
            add(arms, SIDES, band(-7, 7, material("leather", gear.colour)));
            add(arms, ["bottom"], material("leather", gear.colour));
            break;
        case "gauntlets":
            add(arms, SIDES, band(-10, 10, material(surfaceOf("hands", gear), gear.colour)));
            add(arms, ["bottom"], material("plate", gear.colour));
            break;
        default:
            break;
    }
}

function neckline(skin)
{
    return (raster, area) =>
    {
        const middle = Math.floor(area.w / 2);

        for(let y = 0; y < 4; y++) { Pixels.rect(raster, area, middle - 3 + y, y, 6 - y * 2, 1, Pixels.shade(skin, 0.95)); }
    };
}

function straps(colour)
{
    return (raster, area) =>
    {
        for(let y = 0; y < area.h - 6; y++)
        {
            Pixels.dot(raster, area, 4 + Math.floor(y / 4), y, colour);
            Pixels.dot(raster, area, area.w - 5 - Math.floor(y / 4), y, colour);
        }
    };
}

function buttons(colour)
{
    return (raster, area) =>
    {
        const middle = Math.floor(area.w / 2);

        Pixels.rect(raster, area, middle, 0, 1, area.h, Pixels.shade(colour, 0.35));

        for(let y = 4; y < area.h - 3; y += 4)
        {
            Pixels.dot(raster, area, middle - 2, y, colour);
            Pixels.dot(raster, area, middle + 2, y, colour);
        }
    };
}

function tabard(colour, width)
{
    const half = Math.max(4, Math.round(width * 0.22));

    return strip(Math.floor(width / 2) - half, half * 2, (raster, area, random) =>
    {
        Pixels.cloth(raster, area, random, colour);

        const middle = Math.floor(area.w / 2);
        const charge = Pixels.shade(colour, 2.6);

        Pixels.rect(raster, area, middle - 1, 4, 2, 13, charge);
        Pixels.rect(raster, area, middle - 4, 8, 8, 2, charge);
    });
}
