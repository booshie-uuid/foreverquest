# World

A zone is content: a folder in [content/zones/](../content/zones/) that holds a zone file and the zone's terrain images. The zone file lists the zone's ground, its lighting, its people and the props placed on it. The props are prefabs, built from blocks by the functions in [content/art/props.js](../content/art/props.js) and listed in [content/props/prefabs.js](../content/props/prefabs.js). The bake checks every zone and prefab, builds each zone's cubes, and writes them to `assets/`. The game loads a zone's baked files, holds its data in [ZoneData](../js/sim/zone-data.js), and draws it with [ZoneView](../js/render/zone-view.js).

Two zones exist: Hearthmere, the village, and the Test Field, a small zone that the tests travel to. Hearthmere was exported once from the prototype's generator and then converted from one-metre tiles to cubes, so its colliders match the prototype's.

## Cubes and Cells

The world is built from cubes 1/3 metre on a side, the size of a character's head. A cell is one cube's place in the zone, counted in whole numbers: x and z from the zone's -x and -z edges, and y up from the bottom of the zone. Metres appear only where the game needs them, so cell positions never gather rounding error.

| Unit | Size |
|---|---|
| Cell | 1/3 metre; three cells make a metre |
| Chunk | 32 by 32 by 32 cells, 10 2/3 metres a side; the unit of storage and drawing |
| Region | 256 by 256 columns of cells, 85 1/3 metres a side; the unit of a terrain image and a baked file |

Each cell holds one block type, or air. [Adding a Block Type](assets.md#adding-a-block-type) describes block types.

## Zone Folders

A zone folder holds `zone.json` and a `terrain` folder with one image per region, named `<x>-<z>.png` from region `0-0` at the -x, -z corner. A region at the +x or +z edge is as wide or deep as the columns left. The zone file is JSON, with each prop on one line, so a diff shows what changed.

| Field | Holds |
|---|---|
| `id`, `name` | The zone's id, which matches its folder, and the name the game shows |
| `welcome` | Optional lines the chat shows when the player arrives |
| `columns` | The width and depth in cells, a whole multiple of 32 |
| `height` | The height in cells, a whole multiple of 32 up to 256 |
| `base` | The cell whose bottom is at height 0 in metres |
| `water` | The cell below which every empty cell of a column fills with water |
| `ground` | The ground layers `{ top, under }`, two solid block types each, that the terrain images refer to by index |
| `lighting` | The sky, fog, hemisphere, moon and lamp colours and strengths |
| `spawn` | Where the player arrives, in metres, and the heading they face |
| `people` | The residents and the crowd; see [People](#people) |
| `props` | Prefab placements `{ prefab, x, z, angle, scale }` and runs `{ run, points }`, in metres |

A terrain image gives each column two values. Red is the column's surface, the cell above its top solid cell. Green is the index of its ground layer. The bake fills each column from the bottom: rock, then three cells of the ground's `under` block, then its `top` block, then water up to the `water` cell. On high ground, 12 cells or more above the base, and on the face of a drop of more than four cells, the three cells under the top are rock.

A placement stands its prefab on the surface under it, turned by `angle` radians about y and scaled by `scale`, which defaults to 1. The bake fails on a missing or wrongly sized terrain image, a column taller than the zone or with an unknown ground index, a ground block that is not solid, an unknown prefab, a prop or spawn outside the zone, and an unknown resident or archetype.

## Baked Zones

The bake writes `zones/<id>/index.json` and one file per region, `zones/<id>/<x>-<z>.bin`. A region file is compressed with deflate. It holds the surface of each column and the region's chunks. A chunk of one block type, such as buried rock, is stored as that one block; a chunk of air is left out. [region-codec.js](../js/sim/region-codec.js) writes and reads the format.

`ZoneData.blockAt(x, y, z)` returns the block number in a cell, and `surface(column, row)` a column's surface. In metres, `heightAt(x, z)` returns the height of the surface under a point, `typeAt(x, z)` the block type on top, and `isWater(x, z)` whether water lies on it.

## Prefabs and Runs

A prefab is a prop built at the origin, facing +z, at a scale of 1. The bake runs each prefab function once and records its blocks, its colliders and the light spots where lamps hang. Species such as `pine`, `oak`, `deadTree`, `rock`, `bush`, `weeds` and `grave` bake eight variants each, seeded apart, so a forest repeats a species without repeating one shape.

| Prefab functions return | Used for |
|---|---|
| `{ x, z, radius }` or `{ collider }` | A circle, or a turned box `{ x, z, halfWidth, halfDepth, angle }`, that blocks movement |
| `{ lights }` or `{ light }` | Points where a lamp lights the zone |

`Props.block(builder, size, at, faces, rotation)` records one block in metres. `faces` is a texture name for every face, or a map from face names to texture names with `all` as the fallback. Inside a prop, the `put` function that `placed()` returns adds blocks in the prop's own frame.

A run lays a prop along a line of points and follows the ground, such as a fence. The bake builds each run in the zone's own coordinates, with its posts at the height of the surface under them, and stores the blocks and colliders with the zone.

## Collision and Movement

`ZoneData.resolveStep(from, to, radius)` pushes a moving circle out of every nearby circle and box collider, twice over, then checks the column it lands on. The step is refused when that column is under water, within 2 metres of the zone's edge, or more than half a metre above the column the entity stands on, so an entity steps up one cube and not two. An entity eases its height towards the surface under it, so a step reads as a short climb.

The zone keeps its colliders in a grid of 4-metre cells. A step tests only the colliders in the cells near it, in the zone's order, so it resolves exactly as a test of every collider would. `ZoneData` uses no Three.js and no page, so the simulation can run without a renderer.

## Drawing a Zone

`ZoneView` builds one terrain mesh per chunk, with [CubeMesher](../js/render/cube-mesher.js), and the props in squares of 16 metres, so Three.js leaves out the meshes outside the camera. The mesher draws a cube face only where the cell beside it is not opaque, and lays each texture across the faces in world cells, so a texture continues from one cube to the next. It merges neighbouring faces of one texture and one shading into a single rectangle, so a flat floor of a chunk is two triangles. Each corner of a face darkens a step for each opaque cube that touches it in front of the face, which shades the foot of every step and wall. The mesher returns plain arrays and uses no Three.js. Water is one plane at the water line. The props share one material and the terrain another, which also takes the corner shading as vertex colours; both read their textures from the world texture array. `dispose()` frees every mesh and the shadow map the view made, and leaves the shared materials alone.

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
3. To add a world texture, follow [Adding a World Texture](assets.md#adding-a-world-texture). To use it as ground, give it a block type and add a ground layer to the zone's `ground`.
4. To add a zone, make a folder in [content/zones/](../content/zones/) with a zone file and its terrain images.

Run `npm run bake`, then `npm run bake -- --accept` once the change looks right, then `npm test` and `node js-tests/browser/run.js --covers zones`.
