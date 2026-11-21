# World

A zone is content: a zone file in [content/zones/](../content/zones/) that lists its tiles, its lighting, its people and the props placed on it. The props are prefabs, built from blocks by the functions in [content/art/props.js](../content/art/props.js) and listed in [content/props/prefabs.js](../content/props/prefabs.js). The bake checks every zone and prefab and writes them to `assets/`. The game loads a zone's baked file, holds its data in [ZoneData](../js/sim/zone-data.js), and draws it with [ZoneView](../js/render/zone-view.js).

Two zones exist: Hearthmere, the village, and the Test Field, a small zone that the tests travel to. Hearthmere was exported once from the prototype's generator, so its tiles and colliders match the prototype's.

## Zone Files

A zone file is JSON. It writes each tile row and each prop on one line, so a diff shows what changed.

| Field | Holds |
|---|---|
| `id`, `name` | The zone's id, and the name the game shows |
| `welcome` | Optional lines the chat shows when the player arrives |
| `size` | The width and depth in one-metre tiles, a whole multiple of 16 |
| `step`, `waterLevel` | The height of one level in metres, and the height below which a tile is under water |
| `typeCodes` | One letter for each tile type, which names a world texture, such as `"g": "grass"` |
| `levels` | One row of comma-separated whole-number levels per row of tiles, from -z to +z |
| `types` | One row of type letters per row of tiles |
| `lighting` | The sky, fog, hemisphere, moon and lamp colours and strengths |
| `spawn` | Where the player arrives, and the heading they face |
| `people` | The residents and the crowd; see [People](#people) |
| `props` | Prefab placements `{ prefab, x, z, angle, scale }` and runs `{ run, points }` |

A placement stands its prefab on the tile under it, turned by `angle` radians about y and scaled by `scale`, which defaults to 1. The bake fails on a row of the wrong length, an unknown type letter or prefab, a type with no world texture, a prop or spawn outside the zone, and an unknown resident or archetype.

## Tiles

Each tile is flat, so `heightAt(x, z)` returns the height of the tile under a point. Where a tile stands above a neighbour, the terrain adds a side face down to the neighbour's height: earth for a drop of up to 1.5 metres, and dark stone for a taller drop or for a tile 4 metres high or more. Each tile's top takes the texture of its type.

## Prefabs and Runs

A prefab is a prop built at the origin, facing +z, at a scale of 1. The bake runs each prefab function once and records its blocks, its colliders and the light spots where lamps hang. Species such as `pine`, `oak`, `deadTree`, `rock`, `bush`, `weeds` and `grave` bake eight variants each, seeded apart, so a forest repeats a species without repeating one shape.

| Prefab functions return | Used for |
|---|---|
| `{ x, z, radius }` or `{ collider }` | A circle, or a turned box `{ x, z, halfWidth, halfDepth, angle }`, that blocks movement |
| `{ lights }` or `{ light }` | Points where a lamp lights the zone |

`Props.block(builder, size, at, faces, rotation)` records one block in metres. `faces` is a texture name for every face, or a map from face names to texture names with `all` as the fallback. Inside a prop, the `put` function that `placed()` returns adds blocks in the prop's own frame.

A run lays a prop along a line of points and follows the ground, such as a fence. The bake builds each run in the zone's own coordinates, with its posts at the height of the tiles under them, and stores the blocks and colliders with the zone.

## Collision and Movement

`ZoneData.resolveStep(from, to, radius)` pushes a moving circle out of every nearby circle and box collider, twice over, then checks the tile it lands on. The step is refused when that tile is under water, within 2 metres of the zone's edge, or more than half a metre above the tile the actor stands on. An actor eases its height towards the tile under it, so a quarter-metre step reads as a short climb.

The zone keeps its colliders in a grid of 4-metre cells. A step tests only the colliders in the cells near it, in the zone's order, so it resolves exactly as a test of every collider would. `ZoneData` uses no Three.js and no page, so the simulation can run without a renderer.

## Drawing a Zone

`ZoneView` builds the terrain and the props in chunks of 16 by 16 tiles, one mesh per chunk for each, so Three.js leaves out the chunks outside the camera. Every terrain tile and prop shares one material, which reads its textures from the world texture array. `dispose()` frees every mesh and the shadow map the view made, and leaves the shared materials alone.

| Light | Purpose |
|---|---|
| Hemisphere | Cold sky from above and warm earth from below |
| Directional moonlight | The main light; casts shadows in a 52-metre square around the player |
| Point lights | Six lamps, placed each frame at the light spots nearest the player |
| Glow texels | Window panes, lamps and lanterns light themselves |
| Fog | Fades the zone into the horizon colour between the fog's `near` and `far` |

The number of point lights stays fixed, because changing it recompiles every lit shader. Light spots farther away still glow from their glow texels.

## People

A zone's `people` field places its villagers:

| Field | Holds |
|---|---|
| `seed` | The seed of the one random stream that the residents and then the crowd draw from, so a zone always gets the same villagers |
| `residents` | `{ npc, home, roam }`: a villager from [content/npcs/](../content/npcs/), the point they wander around, and how far they roam |
| `crowd` | Random villagers placed in a ring: their `count`, `centre`, `radius`, `startAngle` and `roam`, the `lines` they say, and the `archetypes` they cycle through, where `null` picks a random archetype |

A villager file exports `NPCS`, each with a `name`, the `lines` they say, an optional `role` such as `tailor`, and their `look`, an appearance record. It also exports `LINES`, the shared lines that crowds say.

## Travelling

`App.travel(id)` loads a zone and the game screen enters it: it frees the last zone's view and villagers, moves the player to the new spawn point and places the new villagers. The address `?zone=testfield` starts the game in another zone.

## Adding to the World

1. To add a prop, write a function in [content/art/props.js](../content/art/props.js) that builds with `placed()` and returns its collider, and list it in `PREFABS` in [content/props/prefabs.js](../content/props/prefabs.js). Check it in the workbench's prop viewer.
2. To place props, add placements to a zone file's `props`.
3. To add a world texture, follow [Adding a World Texture](assets.md#adding-a-world-texture). To use it as a tile type, give it a letter in the zone's `typeCodes`.
4. To add a zone, write a zone file in [content/zones/](../content/zones/).

Run `npm run bake`, then `npm run bake -- --accept` once the change looks right, then `npm test` and `node js-tests/browser/run.js --covers zones`.
