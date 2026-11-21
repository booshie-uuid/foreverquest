import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

const FOLDER = path.resolve(import.meta.dirname, "..", "..", "content", "clips");
const AXES = ["x", "y", "z", "lift"];
const LOOPS = ["idle", "walk", "run"];


/******************************************************************************/
/* BAKE                                                                       */
/******************************************************************************/

export async function bake(problems, context)
{
    const files = [];
    const rigs = [];
    const actions = [];

    for(const file of fs.readdirSync(FOLDER).filter((name) => name.endsWith(".js")).sort())
    {
        const clips = (await import(url.pathToFileURL(path.join(FOLDER, file)).href)).CLIPS;

        if(!clips) { continue; }

        const where = "Clips clips/" + file;
        const rig = context.rigs.get(clips.rig);

        if(!rig) { problems.push(where + " are for an unknown rig: " + clips.rig); continue; }

        checkClips(clips, rig, where, problems);
        rigs.push(rig.id);
        actions.push(...Object.keys(clips.actions ?? {}).map((name) => rig.id + "/" + name));
        files.push({ path: "models/clips/" + rig.id + ".json", bytes: Buffer.from(JSON.stringify(clips, null, 4) + "\n") });
    }

    files.push({ path: "models/clips/index.json", bytes: Buffer.from(JSON.stringify(rigs, null, 4) + "\n") });

    return { files, ids: { "clip": rigs, "action": actions } };
}

export function checkClips(clips, rig, where, problems)
{
    const motion = clips.locomotion ?? {};

    if(!(motion.walk > 0 && motion.run > motion.walk)) { problems.push(where + " need a walk speed and a faster run speed"); }
    if(!rig.boxes.includes(motion.strideBox)) { problems.push(where + " measure the stride with an unknown box: " + motion.strideBox); }
    if(!(motion.stride?.length === 2 && motion.stride.every((value) => value > 0))) { problems.push(where + " need a walking and a running stride, in box heights"); }

    for(const loop of LOOPS)
    {
        for(const channel of clips[loop] ?? []) { checkChannel(channel, rig, where + " " + loop, problems, loop === "idle"); }
    }

    for(const [name, action] of Object.entries(clips.actions ?? {}))
    {
        if(!(action.seconds > 0 && action.fade >= 0)) { problems.push(where + " action " + name + " needs seconds and a fade"); }

        for(const channel of action.channels ?? []) { checkChannel(channel, rig, where + " action " + name, problems, true); }
    }
}

function checkChannel(channel, rig, where, problems, isTimed)
{
    const bone = rig.bones.find((entry) => entry.name === channel.bone);

    if(!bone) { problems.push(where + " moves an unknown bone: " + channel.bone); }
    if(!AXES.includes(channel.axis)) { problems.push(where + " moves " + channel.bone + " on an unknown axis: " + channel.axis); }
    if(!(Array.isArray(channel.keys) && channel.keys.length > 0 && channel.keys.every(Number.isFinite))) { problems.push(where + " needs numeric keys for " + channel.bone); }
    if(isTimed && channel.keys?.length > 1 && !(channel.period > 0)) { problems.push(where + " needs a period for " + channel.bone + " " + channel.axis); }
}
