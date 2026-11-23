import * as Capture from "./capture.js";
import * as Fitter from "../../js/kit/fitter.js";
import { Appearance } from "../../js/character/appearance.js";

// Changes made on purpose since the prototype was recorded. Each moves the
// recorded blocks to where the change puts them, so the reference tests keep
// comparing everything else exactly.

const POLE_SOCKET = "pole.R";
const POLE_GAP = 1.4;
const LOOK_SLOTS = ["nose", "hair", "beard"];
const NOSE_HEIGHT = 4;

export function departed(library, look, records)
{
    return polesDeparted(library, look, nosesDeparted(library, look, records));
}

// A nose shorter than NOSE_HEIGHT texels ends where a nose of that height
// ends, rather than starting at the eye line, so it moves down by the
// difference.
function nosesDeparted(library, look, records)
{
    const part = [...library.parts.values()].find((entry) => entry.slot === "nose" && entry.id === look.nose);
    const block = part?.blocks[0];

    if(!block || block.size[1].c >= NOSE_HEIGHT) { return records; }

    const height = block.size[1].c;
    const size = JSON.stringify(block.size.map((form) => form.c));

    return records.map((record) =>
    {
        if(record.joint !== "head" || JSON.stringify(record.size) !== size || record.at[2] < 8) { return record; }

        return { ...record, at: [record.at[0], Capture.round(record.at[1] + height - NOSE_HEIGHT), record.at[2]] };
    });
}

// A pole held in the right hand (a staff, spear or pitchfork) stands in front
// of the arm, at the pole.R socket, rather than through the middle of the
// hand. Its blocks move forward by half the arm's depth and POLE_GAP.
function polesDeparted(library, look, records)
{
    const item = look.equipment?.mainHand?.item;
    const part = [...library.parts.values()].find((entry) => entry.slot === "mainHand" && entry.id === item);
    const poles = (part?.blocks ?? []).filter((block) => block.at === POLE_SOCKET);

    if(poles.length === 0) { return records; }

    const appearance = new Appearance(library, look);
    const fitted = Fitter.fit(library.rig(appearance.body.rig), appearance.body, { variant: appearance.get("variant"), height: appearance.get("height"), build: appearance.get("build") });
    const sizes = poles.map((block) => JSON.stringify(Capture.round(block.size.map((form) => Fitter.evaluate(form, fitted.boxes)))));
    const shift = fitted.boxes.arm[2] / 2 + POLE_GAP;

    return records.map((record) =>
    {
        if(record.joint !== "armR" || !sizes.includes(JSON.stringify(record.size))) { return record; }

        return { ...record, at: [record.at[0], record.at[1], Capture.round(record.at[2] + shift)] };
    });
}

// The same, for a case of Capture.partSweep, named "body variant slot=item".
export function departedCase(library, label, records)
{
    const [body, variant, choice] = label.split(" ");
    const [slot, item] = choice.split("=");

    const look = LOOK_SLOTS.includes(slot) ? { body, variant, [slot]: item } : { body, variant, equipment: { [slot]: { item } } };

    return departed(library, look, records);
}
