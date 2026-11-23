import * as Pathfinder from "./pathfinder.js";
import { Appearance } from "../character/appearance.js";
import { Entity } from "./entity.js";
import { NpcBrain } from "./npc-brain.js";
import { Random } from "../util/random.js";

const TICK = 1 / 20;
const TALK_RANGE = 2.2;


/******************************************************************************/
/* SIMULATION                                                                 */
/******************************************************************************/

// Commands queue until the next tick. Events go to every listener as they
// happen: "entered", "said", "waved" and "running".
export class Simulation
{
    static TICK = TICK;

    constructor(library, people)
    {
        this.library = library;
        this.people = people;
        this.zone = null;
        this.player = null;
        this.entities = [];
        this.commands = [];
        this.listeners = [];
        this.talkTarget = null;
        this.ticks = 0;
        this.nextId = 1;
    }

    get npcs()
    {
        return this.entities.filter((entity) => entity !== this.player);
    }

    entity(id)
    {
        return this.entities.find((entity) => entity.id === id) ?? null;
    }

    setPlayer(appearance)
    {
        this.player = new Entity(this.nextId++, appearance);
    }

    /* ZONES ******************************************************************/

    // The residents come first and the crowd after, from one random stream,
    // so a zone always gets the same villagers.
    enter(zone)
    {
        const spawn = zone.spawn;

        this.zone = zone;
        this.talkTarget = null;
        this.commands = [];
        this.player.stop();
        this.player.placeAt(spawn.x, spawn.z, zone, spawn.heading);
        this.entities = [this.player, ...this.populate(zone.people)];
        this.emit({ type: "entered", zone });
    }

    populate(people)
    {
        const random = new Random(people.seed);
        const npcs = [];

        for(const placed of people.residents)
        {
            const npc = this.people.npcs[placed.npc];

            npcs.push(this.spawn(new Appearance(this.library, npc.look), { home: placed.home, roam: placed.roam, lines: npc.lines, role: npc.role }, random));
        }

        const crowd = people.crowd;

        for(let i = 0; i < (crowd?.count ?? 0); i++)
        {
            const angle = (i / crowd.count) * Math.PI * 2 + crowd.startAngle;
            const home = [crowd.centre[0] + Math.cos(angle) * crowd.radius, crowd.centre[1] + Math.sin(angle) * crowd.radius];
            const archetype = crowd.archetypes[i % crowd.archetypes.length] ?? undefined;
            const look = Appearance.randomData(this.library, random, { archetype });

            npcs.push(this.spawn(new Appearance(this.library, look), { home, roam: crowd.roam, lines: this.people.lines[crowd.lines] }, random));
        }

        return npcs;
    }

    spawn(appearance, resident, random)
    {
        const entity = new Entity(this.nextId++, appearance);

        entity.brain = new NpcBrain(entity, resident, random);
        entity.placeAt(resident.home[0], resident.home[1], this.zone, random.range(0, Math.PI * 2));

        return entity;
    }

    /* COMMANDS ***************************************************************/

    command(command)
    {
        this.commands.push(command);
    }

    apply(command)
    {
        const player = this.player;

        switch(command.type)
        {
            case "moveTo":
                this.talkTarget = null;
                this.route(player, command);
                break;
            case "steer":
                if(command.x !== 0 || command.z !== 0) { this.talkTarget = null; }

                player.steer(command.x, command.z);
                break;
            case "stop":
                player.stop();
                break;
            case "run":
                player.setRunning(command.isRunning);
                this.emit({ type: "running", isRunning: player.isRunning });
                break;
            case "talk":
                this.talkTarget = command.id;
                player.moveTo(this.entity(command.id).position);
                break;
            case "wave":
                this.emit({ type: "waved", id: player.id });
                break;
            default:
                throw new Error("Unknown command: " + command.type);
        }
    }

    /* TICK *******************************************************************/

    tick()
    {
        for(const command of this.commands.splice(0)) { this.apply(command); }

        this.talk();

        for(const npc of this.npcs.filter((entity) => this.isAwake(entity))) { npc.brain.tick(TICK, this.zone); }
        for(const entity of this.entities.filter((each) => this.isAwake(each))) { entity.tick(TICK, this.zone); }

        this.ticks++;
    }

    isAwake(entity)
    {
        return this.zone.isLoaded(entity.position.x, entity.position.z);
    }

    // A route the pathfinder cannot find becomes a straight walk, which stops
    // at the first obstacle.
    route(entity, point)
    {
        const path = Pathfinder.find(this.zone, entity.position, point, entity.radius);

        if(path && path.length > 0) { entity.follow(path); }
        else { entity.moveTo(point); }
    }

    talk()
    {
        const npc = this.entity(this.talkTarget);
        const player = this.player;

        if(!npc) { return; }

        if(player.distanceTo(npc) > TALK_RANGE)
        {
            if(!player.target) { player.moveTo(npc.position); }

            return;
        }

        this.talkTarget = null;
        player.stop();
        player.face(npc.position);

        const line = npc.brain.greet(player);

        this.emit({ type: "said", id: npc.id, name: npc.name, line, role: npc.brain.role });
        this.emit({ type: "waved", id: npc.id });
    }

    /* EVENTS *****************************************************************/

    onEvent(listener)
    {
        this.listeners.push(listener);

        return () =>
        {
            this.listeners = this.listeners.filter((entry) => entry !== listener);
        };
    }

    emit(event)
    {
        for(const listener of this.listeners) { listener(event); }
    }
}
