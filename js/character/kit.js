import * as Catalogue from "./catalogue.js";
import * as Pixels from "../art/pixels.js";

export const TEXEL = 1.8 / 88;

const HEAD = 16;
const BONE = "#cfc6ae";
const HOLD_ANGLE = Math.PI / 2 + 0.55;


/******************************************************************************/
/* BODY                                                                       */
/******************************************************************************/

export function dimensions(look)
{
    const race = Catalogue.find(Catalogue.RACES, look.get("race"));
    const body = Catalogue.find(Catalogue.BODY_TYPES, look.get("body"));
    const build = Math.round(look.get("build") * 2);

    const torso =
    [
        race.torso[0] + body.torso[0] + build * 2,
        race.torso[1] + body.torso[1],
        race.torso[2] + body.torso[2] + build,
    ];
    const armWidth = race.arm[0] + body.arm + build;

    return {
        head: [HEAD, HEAD, HEAD],
        torso,
        arm: [armWidth, race.arm[1], armWidth],
        leg: [torso[0] / 2, race.leg, torso[2]],
        scale: 1 + look.get("height") * 0.06,
    };
}

export function height(dims)
{
    return (dims.leg[1] + dims.torso[1] + dims.head[1]) * TEXEL * dims.scale;
}

// Joint positions in texels, each relative to its parent joint.
export function joints(dims)
{
    const [torsoWidth, torsoHeight, torsoDepth] = dims.torso;
    const shoulder = torsoHeight - 2;

    return {
        legL: { parent: "root", at: [dims.leg[0] / 2, dims.leg[1], 0] },
        legR: { parent: "root", at: [-dims.leg[0] / 2, dims.leg[1], 0] },
        torso: { parent: "root", at: [0, dims.leg[1], 0] },
        head: { parent: "torso", at: [0, torsoHeight, 0] },
        armL: { parent: "torso", at: [(torsoWidth + dims.arm[0]) / 2, shoulder, 0] },
        armR: { parent: "torso", at: [-(torsoWidth + dims.arm[0]) / 2, shoulder, 0] },
        cape: { parent: "torso", at: [0, torsoHeight - 1, -torsoDepth / 2 - 0.7] },
    };
}

export function bodyBlocks(dims)
{
    return [
        { joint: "head", part: "head", size: dims.head, at: [0, HEAD / 2, 0] },
        { joint: "torso", part: "torso", size: dims.torso, at: [0, dims.torso[1] / 2, 0] },
        { joint: "armL", part: "armL", size: dims.arm, at: [0, -dims.arm[1] / 2 + 2, 0] },
        { joint: "armR", part: "armR", size: dims.arm, at: [0, -dims.arm[1] / 2 + 2, 0] },
        { joint: "legL", part: "legL", size: dims.leg, at: [0, -dims.leg[1] / 2, 0] },
        { joint: "legR", part: "legR", size: dims.leg, at: [0, -dims.leg[1] / 2, 0] },
    ];
}


/******************************************************************************/
/* PARTS                                                                      */
/******************************************************************************/

function paint(kind, colour)
{
    return (raster, area, random) => Pixels[kind](raster, area, random, colour);
}

function flat(colour)
{
    return (raster, area, random) => Pixels.grit(raster, area, colour, random, 0.1);
}

function part(joint, size, at, faces, rotation = null)
{
    return { joint, size, at, faces, rotation };
}

export function partBlocks(look, dims)
{
    const blocks = [];
    const headItem = Catalogue.item("head", look.equipped("head").item);

    addFeatures(blocks, look);

    if(!headItem.hidesHair) { addHair(blocks, look.get("hair"), look.get("hairColour")); }

    addBeard(blocks, look.get("beard"), look.get("hairColour"));
    addHeadgear(blocks, look.equipped("head"), dims);
    addArmour(blocks, look, dims);
    addBack(blocks, look.equipped("back"), dims);
    addMainHand(blocks, look.equipped("mainHand"), dims);
    addOffHand(blocks, look.equipped("offHand"), dims);

    return blocks;
}

function addFeatures(blocks, look)
{
    const race = Catalogue.find(Catalogue.RACES, look.get("race"));
    const nose = Catalogue.find(Catalogue.NOSES, look.get("nose"));
    const skin = look.get("skin");
    const ear = flat(Pixels.shade(skin, 0.92));
    const [, noseHeight, noseDepth] = nose.size;

    blocks.push(part("head", nose.size, [0, 6 - noseHeight / 2 + 2.5, HEAD / 2 + noseDepth / 2], { all: flat(Pixels.shade(skin, 0.95)) }));

    for(const side of [1, -1])
    {
        const x = side * (HEAD / 2 + 0.5);

        switch(race.ears)
        {
            case "long":
                blocks.push(part("head", [1, 3, 2], [x, 8.5, -1], { all: ear }));
                blocks.push(part("head", [1, 2, 6], [x + side * 0.6, 11, -3.5], { all: ear }, [0.6, 0, -side * 0.35]));
                break;
            case "pointed":
                blocks.push(part("head", [1, 4, 2], [x, 9, -1], { all: ear }, [0, 0, -side * 0.35]));
                break;
            case "swept":
                blocks.push(part("head", [2, 3, 4], [x + side * 0.5, 9, -2], { all: ear }, [0, side * 0.5, -side * 0.7]));
                break;
            default:
                blocks.push(part("head", [1, 3, 2], [x, 8.5, -1], { all: ear }));
        }

        if(race.hasTusks)
        {
            blocks.push(part("head", [1, 3, 1], [side * 3, 3.5, HEAD / 2 + 0.5], { all: flat(BONE) }));
        }
    }

}

function addHair(blocks, style, colour)
{
    const hair = paint("cloth", colour);
    const dark = paint("cloth", Pixels.shade(colour, 0.8));

    switch(style)
    {
        case "swept":
            blocks.push(part("head", [16, 3, 10], [0, 16.5, 1], { all: hair }, [0.15, 0, 0]));
            break;
        case "long":
            blocks.push(part("head", [18, 18, 3], [0, 6, -8.8], { all: hair }));
            blocks.push(part("head", [2, 12, 12], [8.9, 8, -1.5], { all: hair }));
            blocks.push(part("head", [2, 12, 12], [-8.9, 8, -1.5], { all: hair }));
            break;
        case "tail":
            blocks.push(part("head", [4, 4, 3], [0, 11, -9.3], { all: dark }));
            blocks.push(part("head", [4, 14, 3], [0, 2, -10], { all: hair }, [0.12, 0, 0]));
            break;
        case "braids":
            for(const side of [1, -1])
            {
                blocks.push(part("head", [3, 16, 3], [side * 8.5, 3, 3], { all: braid(colour) }));
            }

            break;
        case "topknot":
            blocks.push(part("head", [6, 5, 6], [0, 18.5, -2], { all: dark }));
            blocks.push(part("head", [3, 4, 3], [0, 22, -2], { all: hair }));
            break;
        case "crest":
            blocks.push(part("head", [4, 4, 18], [0, 17.5, 0], { all: hair }));
            break;
        default:
            break;
    }
}

function braid(colour)
{
    return (raster, area, random) =>
    {
        Pixels.cloth(raster, area, random, colour);

        for(let y = 0; y < area.h; y += 3) { Pixels.rect(raster, area, 0, y, area.w, 1, Pixels.shade(colour, 0.6)); }
    };
}

function addBeard(blocks, style, colour)
{
    const beard = paint("cloth", Pixels.shade(colour, 0.92));

    switch(style)
    {
        case "short":
            blocks.push(part("head", [12, 3, 2], [0, 1.5, 8.8], { all: beard }));
            break;
        case "full":
            blocks.push(part("head", [14, 6, 3], [0, 1, 9], { all: beard }));
            break;
        case "long":
            blocks.push(part("head", [14, 6, 3], [0, 1, 9], { all: beard }));
            blocks.push(part("head", [10, 12, 3], [0, -7, 9.5], { all: braid(colour) }));
            break;
        case "forked":
            blocks.push(part("head", [14, 6, 3], [0, 1, 9], { all: beard }));
            blocks.push(part("head", [3, 10, 3], [-3, -6, 9.5], { all: braid(colour) }));
            blocks.push(part("head", [3, 10, 3], [3, -6, 9.5], { all: braid(colour) }));
            break;
        default:
            break;
    }
}


/******************************************************************************/
/* HEADGEAR                                                                   */
/******************************************************************************/

function addHeadgear(blocks, gear, dims)
{
    const metal = paint("plate", gear.colour);

    switch(gear.item)
    {
        case "hood":
            blocks.push(part("head", [20, 20, 20], [0, 9, -0.5], { front: opening(gear.colour, 3, 4), all: paint("cloth", gear.colour) }));
            blocks.push(part("head", [8, 6, 8], [0, 16, -12], { all: paint("cloth", gear.colour) }, [-0.5, 0, 0]));
            blocks.push(part("torso", [dims.torso[0] + 4, 6, dims.torso[2] + 4], [0, dims.torso[1] - 2, 0], { all: paint("cloth", gear.colour) }));
            break;
        case "coif":
            blocks.push(part("head", [18, 18, 18], [0, 8.5, 0], { front: opening(Pixels.shade(gear.colour, 1), 3, 3, "chain"), all: paint("chain", gear.colour) }));
            blocks.push(part("torso", [dims.torso[0] + 2, 4, dims.torso[2] + 2], [0, dims.torso[1] - 1, 0], { all: paint("chain", gear.colour) }));
            break;
        case "kettle":
            blocks.push(part("head", [30, 1.5, 30], [0, 16.5, 0], { all: metal }));
            blocks.push(part("head", [18, 6, 18], [0, 19.5, 0], { all: metal }));
            blocks.push(part("head", [14, 1.5, 14], [0, 23, 0], { all: metal }));
            break;
        case "helm":
            blocks.push(part("head", [19, 20, 19], [0, 9, 0], { front: visor(gear.colour, gear.trim), all: metal }));
            blocks.push(part("head", [15, 2, 15], [0, 20, 0], { all: metal }));
            break;
        case "horned":
            blocks.push(part("head", [18, 12, 18], [0, 12, 0], { front: browGuard(gear.colour), all: metal }));
            blocks.push(part("head", [2, 7, 1.5], [0, 7, 9.5], { all: metal }));

            for(const side of [1, -1])
            {
                const horn = paint("leather", gear.trim);

                blocks.push(part("head", [6, 3, 3], [side * 11, 15, 0], { all: horn }, [0, 0, side * 0.3]));
                blocks.push(part("head", [3, 6, 3], [side * 14, 18.5, 0], { all: horn }, [0, 0, -side * 0.2]));
                blocks.push(part("head", [2, 4, 2], [side * 14.5, 23, 0], { all: horn }));
            }

            break;
        case "brimmed":
            blocks.push(part("head", [32, 1.2, 32], [0, 16.6, 0], { all: paint("cloth", gear.colour) }));
            blocks.push(part("head", [17, 9, 17], [0, 21, 0], { all: paint("cloth", gear.colour) }));
            blocks.push(part("head", [17.4, 2, 17.4], [0, 18, 0], { all: paint("leather", gear.trim) }));
            break;
        case "circlet":
            blocks.push(part("head", [17, 2, 17], [0, 12, 0], { front: gem(gear.colour, gear.trim), all: metal }));
            break;
        default:
            break;
    }
}

function opening(colour, side, top, kind = "cloth")
{
    return (raster, area, random) =>
    {
        Pixels[kind](raster, area, random, colour);

        for(let y = top; y < area.h; y++)
        {
            for(let x = side; x < area.w - side; x++) { Pixels.clear(raster, area, x, y); }
        }
    };
}

function visor(colour, trim)
{
    return (raster, area, random) =>
    {
        Pixels.plate(raster, area, random, colour);
        Pixels.rect(raster, area, 2, 7, area.w - 4, 2, "#0a0a0c");
        Pixels.rect(raster, area, Math.floor(area.w / 2) - 1, 7, 2, area.h - 7, trim);

        for(let y = 12; y < area.h - 2; y += 2) { Pixels.dot(raster, area, 4, y, "#0a0a0c"); Pixels.dot(raster, area, area.w - 5, y, "#0a0a0c"); }
    };
}

function browGuard(colour)
{
    return (raster, area, random) =>
    {
        Pixels.plate(raster, area, random, colour);
        Pixels.rect(raster, area, 0, area.h - 2, area.w, 2, Pixels.shade(colour, 1.4));
    };
}

function gem(colour, stone)
{
    return (raster, area, random) =>
    {
        Pixels.plate(raster, area, random, colour);
        Pixels.rect(raster, area, Math.floor(area.w / 2) - 1, 0, 2, 2, stone);
    };
}


/******************************************************************************/
/* ARMOUR AND BACK                                                            */
/******************************************************************************/

function addArmour(blocks, look, dims)
{
    const chest = look.equipped("chest");
    const legs = look.equipped("legs");
    const [legWidth, , legDepth] = dims.leg;

    if(chest.item === "plate")
    {
        for(const [joint, side] of [["armL", 1], ["armR", -1]])
        {
            blocks.push(part(joint, [dims.arm[0] + 4, 7, dims.arm[2] + 5], [side * 0.8, 2.5, 0], { all: paint("plate", chest.colour) }, [0, 0, -side * 0.18]));
        }

        for(const joint of ["legL", "legR"])
        {
            blocks.push(part(joint, [legWidth + 2, 9, legDepth + 2], [0, -3.5, 0], { all: paint("plate", chest.colour) }));
        }
    }

    if(chest.item === "jerkin")
    {
        for(const [joint, side] of [["armL", 1], ["armR", -1]])
        {
            blocks.push(part(joint, [dims.arm[0] + 3, 5, dims.arm[2] + 4], [side * 0.6, 2, 0], { all: paint("leather", chest.trim) }));
        }
    }

    const tails = { tunic: [12, chest.colour, "cloth"], robe: [dims.leg[1] - 4, chest.colour, "cloth"], coat: [24, chest.colour, "leather"], mail: [10, chest.colour, "chain"] }[chest.item];

    if(tails)
    {
        const [length, colour, kind] = tails;

        for(const joint of ["legL", "legR"])
        {
            blocks.push(part(joint, [legWidth + 1.6, length, legDepth + 1.6], [0, -length / 2 + 0.5, 0], { top: paint(kind, colour), all: hem(kind, colour) }));
        }
    }

    if(legs.item === "greaves")
    {
        for(const joint of ["legL", "legR"])
        {
            blocks.push(part(joint, [legWidth + 1, 3, 2], [0, -dims.leg[1] * 0.45, legDepth / 2 + 0.6], { all: paint("plate", Pixels.shade(legs.colour, 1.15)) }));
        }
    }
}

function hem(kind, colour)
{
    return (raster, area, random) =>
    {
        Pixels[kind](raster, area, random, colour);
        Pixels.rect(raster, area, 0, area.h - 1, area.w, 1, Pixels.shade(colour, 0.6));
    };
}

function addBack(blocks, gear, dims)
{
    const [torsoWidth, torsoHeight, torsoDepth] = dims.torso;

    switch(gear.item)
    {
        case "cape":
            blocks.push(part("cape", [torsoWidth + 2, torsoHeight + dims.leg[1] * 0.75, 1.2], [0, -(torsoHeight + dims.leg[1] * 0.75) / 2, 0], { all: paint("cloth", gear.colour) }));
            blocks.push(part("torso", [torsoWidth + 3, 3, torsoDepth + 3], [0, torsoHeight - 1, 0], { all: paint("cloth", Pixels.shade(gear.colour, 0.8)) }));
            break;
        case "cloak":
            blocks.push(part("cape", [torsoWidth + 4, torsoHeight + dims.leg[1] * 0.85, 1.2], [0, -(torsoHeight + dims.leg[1] * 0.85) / 2, 0], { all: ragged(gear.colour) }));
            blocks.push(part("torso", [torsoWidth + 5, 7, torsoDepth + 5], [0, torsoHeight - 3, 0], { all: paint("cloth", gear.colour) }));
            break;
        case "pack":
            blocks.push(part("torso", [torsoWidth - 6, 16, 7], [0, torsoHeight * 0.55, -torsoDepth / 2 - 3.5], { all: paint("leather", gear.colour) }));
            blocks.push(part("torso", [torsoWidth - 2, 4, 4], [0, torsoHeight * 0.55 + 10, -torsoDepth / 2 - 3.5], { all: paint("cloth", gear.trim) }));
            break;
        default:
            break;
    }
}

function ragged(colour)
{
    return (raster, area, random) =>
    {
        Pixels.cloth(raster, area, random, colour);

        for(let x = 0; x < area.w; x++)
        {
            const cut = Math.floor(random.next() * 4);

            for(let y = area.h - cut; y < area.h; y++) { Pixels.clear(raster, area, x, y); }
        }
    };
}


/******************************************************************************/
/* HELD ITEMS                                                                 */
/******************************************************************************/

// A held block sits `along` texels down the weapon's length from the grip and
// `across` texels to its edge side, in a weapon held forwards with the tip low.
function holding(joint, grip)
{
    const cos = Math.cos(HOLD_ANGLE);
    const sin = Math.sin(HOLD_ANGLE);

    return (size, along, faces, across = 0) => part(joint, size, [0, grip + along * cos - across * sin, along * sin + across * cos], faces, [HOLD_ANGLE, 0, 0]);
}

function addMainHand(blocks, gear, dims)
{
    const grip = -dims.arm[1] + 4;
    const blade = paint("plate", gear.colour);
    const haft = paint("planks", gear.trim ?? gear.colour);
    const hold = holding("armR", grip);

    switch(gear.item)
    {
        case "sword":
            blocks.push(hold([2, 7, 2], 0, { all: paint("leather", gear.trim) }));
            blocks.push(hold([10, 1.6, 2.4], 4, { all: paint("iron", "#2a2a2c") }));
            blocks.push(hold([1.4, 28, 4], 19, { all: blade }));
            break;
        case "axe":
            blocks.push(hold([2, 32, 2], 10, { all: haft }));
            blocks.push(hold([1.4, 9, 7], 19, { all: blade }, 3.5));
            break;
        case "mace":
            blocks.push(hold([2, 22, 2], 8, { all: haft }));
            blocks.push(hold([5, 6, 5], 20, { all: blade }));
            blocks.push(hold([7, 2, 2], 20, { all: blade }));
            blocks.push(hold([2, 2, 7], 20, { all: blade }));
            break;
        case "spear":
            blocks.push(part("armR", [2, 80, 2], [0, grip + 18, 0], { all: haft }));
            blocks.push(part("armR", [1.4, 9, 3], [0, grip + 62, 0], { all: blade }));
            break;
        case "staff":
            blocks.push(part("armR", [2.4, 74, 2.4], [0, grip + 6, 0], { all: paint("planks", gear.colour) }));
            blocks.push(part("armR", [4, 4, 4], [0, grip + 44, 0], { all: paint("plate", gear.trim) }));
            break;
        case "pitchfork":
            blocks.push(part("armR", [2, 70, 2], [0, grip + 14, 0], { all: paint("planks", gear.colour) }));
            blocks.push(part("armR", [8, 1.4, 1.4], [0, grip + 49, 0], { all: paint("iron", gear.trim) }));

            for(const x of [-3.4, 0, 3.4]) { blocks.push(part("armR", [1, 8, 1], [x, grip + 54, 0], { all: paint("iron", gear.trim) })); }

            break;
        default:
            break;
    }
}

function addOffHand(blocks, gear, dims)
{
    const outside = dims.arm[0] / 2 + 1.2;
    const grip = -dims.arm[1] + 4;

    switch(gear.item)
    {
        case "buckler":
            blocks.push(part("armL", [2, 12, 12], [outside, -dims.arm[1] * 0.55, 0], { left: boss(gear.colour, gear.trim), all: paint("plate", gear.trim) }));
            break;
        case "heater":
            blocks.push(part("armL", [2, 22, 18], [outside, -dims.arm[1] * 0.5, 0], { left: heraldry(gear.colour, gear.trim), all: paint("planks", "#3a2a1d") }));
            break;
        case "lantern":
            blocks.push(part("armL", [5, 7, 5], [0, grip - 7, 0], { top: paint("iron", gear.colour), bottom: paint("iron", gear.colour), all: lamplight() }));
            blocks.push(part("armL", [6, 1.2, 6], [0, grip - 3, 0], { all: paint("iron", gear.colour) }));
            blocks.push(part("armL", [1, 3, 1], [0, grip - 1.5, 0], { all: paint("iron", gear.colour) }));
            break;
        case "dagger":
            blocks.push(holding("armL", grip)([2, 5, 2], 0, { all: paint("leather", gear.trim) }));
            blocks.push(holding("armL", grip)([1, 11, 2.4], 8, { all: paint("plate", gear.colour) }));
            break;
        default:
            break;
    }
}

function boss(colour, rim)
{
    return (raster, area, random) =>
    {
        Pixels.plate(raster, area, random, rim);
        Pixels.rect(raster, area, 2, 2, area.w - 4, area.h - 4, colour);
        Pixels.rect(raster, area, Math.floor(area.w / 2) - 2, Math.floor(area.h / 2) - 2, 4, 4, Pixels.shade(rim, 1.3));
    };
}

function heraldry(field, charge)
{
    return (raster, area, random) =>
    {
        Pixels.cloth(raster, area, random, field);

        const middle = Math.floor(area.w / 2);

        Pixels.rect(raster, area, middle - 1, 3, 2, area.h - 8, charge);
        Pixels.rect(raster, area, 3, Math.floor(area.h * 0.35), area.w - 6, 2, charge);

        for(let y = 0; y < area.h; y++)
        {
            const cut = Math.max(0, Math.floor(((y - area.h * 0.55) / (area.h * 0.45)) * (area.w / 2)));

            for(let x = 0; x < cut; x++)
            {
                Pixels.clear(raster, area, x, y);
                Pixels.clear(raster, area, area.w - 1 - x, y);
            }
        }
    };
}

function lamplight()
{
    return (raster, area, random, glow) =>
    {
        Pixels.glow(raster, area, random);
        Pixels.glow(glow, area, random);
    };
}
