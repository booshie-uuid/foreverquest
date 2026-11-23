import * as fs from "node:fs";
import * as module from "node:module";
import * as path from "node:path";

// Fails the session if anything it loads imports Three.js, so the session
// proves the simulation runs without a renderer.
module.registerHooks(
{
    resolve(specifier, context, nextResolve)
    {
        if(specifier === "three") { throw new Error("The simulation imported Three.js from " + context.parentURL); }

        return nextResolve(specifier, context);
    },
});

const { AssetSource } = await import("../../js/engine/asset-source.js");
const { Appearance } = await import("../../js/character/appearance.js");
const { Library } = await import("../../js/kit/library.js");
const { Simulation } = await import("../../js/sim/simulation.js");
const { ZoneData } = await import("../../js/sim/zone-data.js");
const { BlockSet } = await import("../../js/sim/block-set.js");

const ASSETS = path.resolve(import.meta.dirname, "..", "..", "assets");
const source = await AssetSource.open((file) => fs.promises.readFile(path.join(ASSETS, file)));
const library = await Library.load(source);
const sim = new Simulation(library, await source.json("npcs.json"));
const events = [];
const round = (value) => Math.round(value * 1e6) / 1e6;

sim.onEvent((event) => events.push({ tick: sim.ticks, type: event.type, id: event.id ?? null, line: event.line ?? null }));
sim.setPlayer(new Appearance(library, { name: "Tester" }));
sim.enter(await ZoneData.load(source, "hearthmere", await BlockSet.load(source)));

const run = (ticks) =>
{
    for(let i = 0; i < ticks; i++) { sim.tick(); }
};

run(40);
sim.command({ type: "moveTo", x: 4, z: 4 });
run(120);
sim.command({ type: "run", isRunning: true });
sim.command({ type: "steer", x: -1, z: 0.5 });
run(60);
sim.command({ type: "stop" });
sim.command({ type: "talk", id: sim.npcs.find((npc) => npc.brain.role === "tailor").id });
run(400);
sim.command({ type: "wave" });
run(200);

const entities = sim.entities.map((entity) => ({ id: entity.id, name: entity.name, x: round(entity.position.x), y: round(entity.position.y), z: round(entity.position.z), heading: round(entity.heading) }));

process.stdout.write(JSON.stringify({ ticks: sim.ticks, entities, events }));
