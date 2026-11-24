import * as Buildings from "./buildings.js";
import * as Props from "../art/props.js";
import { Random } from "../../js/util/random.js";

const VARIANTS = 8;

const HOUSES =
{
    "house.inn": { width: 5, depth: 4, roof: "slate", isLit: true, sign: true },
    "house.thatch": { width: 4.4, depth: 4, roof: "thatch", isLit: false },
    "house.slate": { width: 5.2, depth: 4.2, roof: "slate", isLit: true },
    "house.croft": { width: 4.6, depth: 3.8, roof: "thatch", isLit: false },
};

const CRATES = { crate70: 0.7, crate65: 0.65, crate55: 0.55, crate50: 0.5 };

// Each prefab builds at the origin, facing +z, at a scale of 1.
const SPECIES =
{
    pine: (b, random) => Props.pine(b, 0, 0, 0, 1, random),
    oak: (b, random) => Props.oak(b, 0, 0, 0, 1, random),
    deadTree: (b, random) => Props.deadTree(b, 0, 0, 0, 1, random),
    rock: (b, random) => Props.rock(b, 0, 0, 0, 1, random),
    bush: (b, random) => Props.bush(b, 0, 0, 0, 1, random),
    weeds: (b, random) => Props.weeds(b, 0, 0, 0, random),
    grave: (b, random) => Props.grave(b, 0, 0, 0, 0, random),
};

function pedestal(b)
{
    for(let x = -3; x < 3; x++)
    {
        for(let z = -2; z < 2; z++)
        {
            const isEdge = Math.abs(x + 0.5) > 1.5 || Math.abs(z + 0.5) > 1;

            Props.block(b, [1, 0.5, 1], [x + 0.5, isEdge ? -0.3 : -0.25, z + 0.5], { top: isEdge ? "mud" : "cobble", all: "earth" });
        }
    }

    Props.block(b, [0.6, 0.85, 0.6], [-2.4, 0.425, -1.5], { top: "oldPlanks", all: "planks" });
    Props.block(b, [0.55, 0.55, 0.55], [2.5, 0.275, -1.6], "oldPlanks", [0, 0.4, 0]);
}

export const PREFABS =
{
    well: (b) => Props.well(b, 0, 0, 0),
    stocks: (b) => Props.stocks(b, 0, 0, 0, 0),
    lampPost: (b) => Props.lampPost(b, 0, 0, 0, 0),
    barrel: (b) => Props.barrel(b, 0, 0, 0, 0),
    cottage: (b) => Props.cottage(b, 0, 0, 0, 0),
    cart: (b) => Props.cart(b, 0, 0, 0, 0),
    sacks: (b) => Props.sacks(b, 0, 0, 0, 0),
    signpost: (b) => Props.signpost(b, 0, 0, 0, 0),
    gibbet: (b) => Props.gibbet(b, 0, 0, 0, 0),
    chapel: (b) => Props.chapel(b, 0, 0, 0, 0),
    archway: (b) => Props.archway(b, 0, 0, 0, 0),
    landing: (b) => Props.landing(b, 0, 0, 0, 0),
    ...Buildings.PREFABS,
    pedestal,
};

for(const [id, style] of Object.entries(HOUSES)) { PREFABS[id] = (b) => Props.house(b, 0, 0, 0, 0, style); }
for(const [id, size] of Object.entries(CRATES)) { PREFABS[id] = (b) => Props.crate(b, 0, 0, 0, size, 0); }

Object.entries(SPECIES).forEach(([species, build], index) =>
{
    for(let variant = 0; variant < VARIANTS; variant++)
    {
        PREFABS[species + "." + variant] = (b) => build(b, new Random(1000 + index * 100 + variant));
    }
});

export const RUNS =
{
    fence: (b, points, heightAt) => Props.fence(b, points, heightAt),
};
