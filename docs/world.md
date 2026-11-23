# World

A zone is content: a folder in [content/zones/](../content/zones/) that holds a zone file and the zone's terrain images. The zone file lists the zone's ground, its lighting, its people and the props placed on it. The props are prefabs, built from blocks by the functions in [content/art/props.js](../content/art/props.js) and listed in [content/props/prefabs.js](../content/props/prefabs.js). The bake checks every zone and prefab, builds each zone's cubes, and writes them to `assets/`. The game loads a zone's baked files, holds its data in [ZoneData](../js/sim/zone-data.js), and draws it with [ZoneView](../js/render/zone-view.js).

Three zones exist: Hearthmere, the village; the Test Field, a small zone that the tests travel to; and the Expanse, a generated zone one kilometre square that tests how far the engine stretches. Hearthmere was exported once from the prototype's generator and then converted from one-metre tiles to cubes.

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
| `lighting` | The sky, fog, hemisphere and moon colours and strengths, and optionally the stepped light ramps (`steps`) and daylight (`day`) |
| `spawn` | Where the player arrives, in metres, and the heading they face |
| `people` | The residents and the crowd; see [People](#people) |
| `props` | Prefab placements `{ prefab, x, z, angle, scale }` and runs `{ run, points }`, in metres |

A zone folder may hold `terrain.js` in place of the images: a script whose `column(zone, x, z)` returns a column's `[surface, ground]`, drawing its randomness from seeded noise in [content/art/noise.js](../content/art/noise.js). The Expanse is built this way.

A terrain image gives each column two values. Red is the column's surface, the cell above its top solid cell. Green is the index of its ground layer. The bake fills each column from the bottom: rock, then three cells of the ground's `under` block, then its `top` block, then water up to the `water` cell. On high ground, 12 cells or more above the base, and on the face of a drop of more than four cells, the three cells under the top are rock.

A placement stands its prefab on the terrain under it, or a building with a door on the ground in front of its door, turned by `angle` radians about y, to the nearest quarter turn, and scaled by `scale`, which defaults to 1. The bake fails on a missing or wrongly sized terrain image, a column taller than the zone or with an unknown ground index, a ground block that is not solid, an unknown prefab, a prop or spawn outside the zone, and an unknown resident or archetype.

## Baked Zones

The bake writes `zones/<id>/index.json` and one file per region, `zones/<id>/<x>-<z>.bin`. A region file is compressed with deflate. It holds the surface of each column and the region's chunks. A chunk of one block type, such as buried rock, is stored as that one block; a chunk of air is left out; any other chunk is stored as runs of one block, or cell by cell when runs would take more room. It also holds each column's ground: the surface of the terrain under any props. The zone's index lists the light spots of its lamps and windows. [region-codec.js](../js/sim/region-codec.js) writes and reads the format.

`ZoneData.blockAt(x, y, z)` returns the block number in a cell, and `surface(column, row)` a column's surface. In metres, `heightAt(x, z)` returns the height of the surface under a point, `typeAt(x, z)` the block type on top, and `isWater(x, z)` whether water lies on it.

## Prefabs and Runs

A prefab is a prop built at the origin, facing +z, at a scale of 1. The bake runs each prefab function once and records its blocks, its colliders and the light spots where lamps hang. Species such as `pine`, `oak`, `deadTree`, `rock`, `bush`, `weeds` and `grave` bake eight variants each, seeded apart, so a forest repeats a species without repeating one shape.

| Prefab functions return | Used for |
|---|---|
| `{ x, z, radius }` or `{ collider }` | A circle, or a turned box `{ x, z, halfWidth, halfDepth, angle }`, that the workbench shows over the prop |
| `{ lights }` or `{ light }` | Points where a lamp hangs, which the workbench shows over the prop |
| `{ rooms }` | Boxes `{ size, at }` that the bake carves out of the prop's cubes, such as a house's ground floor |
| `{ doors }` | Boxes `{ size, at }` in the prop's front, facing +z, that the bake carves out and leads steps down from |

`Props.block(builder, size, at, faces, rotation)` records one block in metres. `faces` is a texture name for every face, or a map from face names to texture names with `all` as the fallback. Inside a prop, the `put` function that `placed()` returns adds blocks in the prop's own frame.

A run lays a prop along a line of points and follows the ground, such as a fence. The bake builds each run in the zone's own coordinates, with its posts at the height of the surface under them.

### Props as Cubes

The bake turns every placed prefab and run into cubes, which join the region's cells. A placement moves to the nearest cube corner, stands on the terrain under it, turns to the nearest quarter turn and keeps its scale, so a prop built in whole cubes fills whole cells. `cubes(put, from, to, faces)` in [props.js](../content/art/props.js) fills the cubes between two corners counted from the prop's origin, as the cart does. A thin block, such as a window, belongs a little inside the wall's face, so that it replaces the wall's outer cube rather than adding a cube in front of it. Each of its blocks fills the cells whose centres it covers, and counts as at least one cube thick on every side, so thin posts and planks survive. A block becomes the block type that [content/props/blocks.js](../content/props/blocks.js) maps its front texture to: timber to timber, glow to window, and so on. The bake fails on a texture with no block type. Later blocks overwrite earlier ones.

After a prefab's blocks, the bake carves its rooms and doors: every cell whose centre lies inside the box becomes air, with no rounding up. A prefab with a door stands lower than the terrain under it: the bake sinks it by whole cubes until the door's sill is level with the ground in front of the door, so an entity walks in from the street, and the plinth below the floor is buried. Whole cubes keep every block in the cells it fills on level ground. Where the ground falls away from the door, steps of one cube lead away from the door's front, from its sill down to the terrain, each with 2 metres of headroom cleared above it. The houses, the cottage and the chapel have one room and one door each.

Props then draw, shade and block movement as cubes do. The colliders that prefab functions return show in the workbench's prop viewer, and the game no longer uses them. An entity is placed on open ground: `ZoneData.openGround(x, z, radius)` looks outward from a point, up to 4 metres, for the nearest column where the entity stands on the terrain itself rather than on a prop.

## Collision and Movement

An entity is an upright cylinder of its body's radius. `ZoneData.standAt(x, z, feet, radius)` finds where it stands: on the highest solid cell under any part of it whose top is no more than one cube above its feet. It is blocked when a solid cell reaches into the six cells, 2 metres, above that floor, so it steps up one cube but not two, and cannot pass under a ceiling lower than 2 metres. `footingAt` also refuses a floor covered by water, a point within 2 metres of the zone's edge, and a region that is not loaded.

`ZoneData.resolveMove(from, to, radius)` tries the cells at the new point, and failing that, the move along x alone and along z alone, so an entity walking into a wall at an angle slides along it. An entity steps up onto a higher floor at once, which the view blends over the tick, and falls to a lower one under gravity. An entity found inside solid cells, which happens when it was placed before its region loaded, is lifted onto them.

`ZoneData` uses no Three.js and no page, so the simulation can run without a renderer.

## Pathfinding

Clicking the ground asks [Pathfinder](../js/sim/pathfinder.js) for a route. It searches the zone's columns with A*, one node per column an entity can stand in, moving to the eight neighbouring columns by the same rules as a step, and dropping at most one metre. A diagonal move needs both columns beside it open, so a route never cuts a corner. The search stops after 6,000 columns; when it does not reach the goal, the route ends at the column it reached nearest the goal. The route is then straightened: each point that a straight walk from the last kept point can skip is dropped. When no route leaves the start, the player walks straight at the point instead. Villagers still walk straight to the places they choose.

## Streaming

The game never loads a whole zone. [RegionStreamer](../js/engine/region-streamer.js) loads the regions within the zone's fog distance and two chunks more, measured from the player to the nearest edge of each region, and frees a region once it lies 32 metres beyond that. `App` opens a zone through the streamer, which loads the regions around the spawn point before the player arrives; the game screen then updates it each frame from the player's position.

`ZoneData.addRegion` and `removeRegion` change the cells, and `onRegion(listener)` reports each change, which the view follows. A region that is not loaded reads as air with a surface of 0. An entity standing on one sleeps: the simulation skips its brain and its movement. No step enters a region that is not loaded, so the player waits at its edge until it arrives.

## Drawing a Zone

`ZoneView` meshes each chunk with [CubeMesher](../js/render/cube-mesher.js) as its region arrives, and draws the terrain in tiles of two by two columns of chunks, about 21 metres square and the full height of the zone, one mesh each. Tiles keep the draw calls low, and Three.js leaves out the tiles outside the camera. Tiles cast and receive the moon's shadows. In the game, [ChunkWorkers](../js/render/chunk-workers.js) meshes the chunks in web workers, up to eight queued in each, nearest the player first; without workers, as in the unit tests, the view meshes every waiting chunk at once. A chunk of one opaque block closed in on every side is not meshed. The mesher draws a cube face only where the cell beside it is not opaque, and lays each texture across the faces in world cells, so a texture continues from one cube to the next. It merges neighbouring faces of one texture and one shading into a single rectangle, so a flat floor of a chunk is two triangles. Each corner of a face darkens a step for each opaque cube that touches it in front of the face, which shades the foot of every step and wall. The mesher returns plain arrays and imports no Three.js, because a worker does not see the page's import map; the lint enforces it. Water is one plane at the water line. The terrain's material takes the corner shading as vertex colours and reads its textures from the world texture array.

Each face also carries the light of the air cell in front of it, as a sky level and a lamp level from 0 to 15. The mesher works them out for each chunk from its cells and a border of 15 more: sky light is 15 above a column's surface, and lamp light starts at the `light` of a glowing block, such as a window at 12; both spread through cells that are not opaque, one level dimmer a cell. The terrain is drawn by these levels in place of the scene's lights: each face takes the sum of its sky and lamp colours from the zone's ramps, so light falls off in visible steps. The sky colour is dimmed to 0.55 where the moon does not reach a face, because the face looks away from it or lies in its shadow, so roofs, walls and trees cast moon shadows across the steps. Characters are lit the same way, by the levels of the cell they stand in: the mesher records the light above every cube that can be stood on, and `ZoneView.lightAt` reads it each frame, so a villager walking into a dark room darkens with it. A zone's `lighting.steps` gives each ramp as `{ dark, bright, curve }`, and a zone without it takes a cold-moon and amber-lamp default. The player carries a light of level 7, which falls a level a cell around the cell the player stands in. The Day toggle shows the zone by day: the sky, fog and hemisphere light take daylight colours, the sun stands where the moon was and casts the shadows, and stepped light takes daylight ramps. A zone's `lighting.day` can give its own `sky`, `hemisphere`, `sun` and `steps`; a zone without it takes a default. The zone's own `lighting` is its night.

The [camera](../js/game/camera-rig.js) starts in first person, at the player's eyes, 0.93 of the model's height, with the player's own model and nameplate hidden. The mouse wheel zooms out to third person, from 1.5 to 22 metres behind the eyes, and zooming in past 1.5 metres returns to first person. In third person, `ZoneData.raycast` casts a ray through the cells from the eyes towards the camera, and the camera stands 0.25 metres short of the first solid cell. It pulls in at once and eases back out, so walls, ceilings and upper floors never hide the player, on any storey.

| Light | Purpose |
|---|---|
| Stepped light | Lights the terrain and the characters by light levels; see above |
| Directional moonlight | Casts shadows in a 52-metre square around the player, which stepped light reads |
| Hemisphere | Cold sky from above and warm earth from below, for the water |
| Glow texels | Window panes, lamps and lanterns light themselves |
| Fog | Fades the zone into the horizon colour between the fog's `near` and `far` |

## Fine-Cube Objects

A zone's `props` also place fine-cube objects, as `{ object, x, z, angle }`; [Adding an Object](assets.md#adding-an-object) describes how to build one. `x` and `z` give the middle of the object's footprint. The bake turns the object by the nearest quarter turn, moves its corner to the nearest cube corner, and stands it on the terrain. A solid object fills each of its cells that holds at least one fine cube with the `object` block type, whose kind `object` blocks movement and can be stood on, but is never drawn and lets light through, so the ground under the object still draws and is still lit. Cells the object leaves empty stay open, so an entity walks under a lamp post's lantern and beside a signpost's pole. The object's `light` cell takes the `objectLight` block type instead, which is the same but gives lamp light of level 12, as a window does. The zone's index lists each placed object with its position, its quarter turns and its cells.

`ZoneView` draws every object of one kind in one region with a single instanced mesh, which loads and frees with its region. Each object takes the stepped light of the cell above its top, as characters do, and the moon's shadow.

## Inspecting Props

The zone's index lists each placed prop as an object: its number in the zone file's `props`, its prefab or run, its position, its quarter turns and the box of cells its blocks reach. Right-clicking without dragging casts a ray through the cells, and the chat names what it meets: a villager, the prop whose box holds the cell, choosing the smallest box where boxes overlap, or the ground. Each line gives the prop's number, so a broken prop can be reported and found in the zone file.

## People

A zone's `people` field places its villagers:

| Field | Holds |
|---|---|
| `seed` | The seed of the one random stream that the residents and then the crowd draw from, so a zone always gets the same villagers |
| `residents` | `{ npc, home, roam }`: a villager from [content/npcs/](../content/npcs/), the point they wander around, and how far they roam |
| `crowd` | Random villagers placed in a ring: their `count`, `centre`, `radius`, `startAngle` and `roam`, the `lines` they say, and the `archetypes` they cycle through, where `null` picks a random archetype |

A villager file exports `NPCS`, each with a `name`, the `lines` they say, an optional `role` such as `tailor`, and their `look`, an appearance record. It also exports `LINES`, the shared lines that crowds say.

## Travelling

`App.travel(id)` loads a zone and the game screen enters it: it frees the last zone's view and villagers, moves the player to the new spawn point and places the new villagers. The address `?zone=testfield` or `?zone=expanse` starts the game in another zone.

## Adding to the World

1. To add a prop, write a function in [content/art/props.js](../content/art/props.js) that builds with `placed()` and returns its collider, and list it in `PREFABS` in [content/props/prefabs.js](../content/props/prefabs.js). Check it in the workbench's prop viewer.
2. To place props, add placements to a zone file's `props`.
3. To add a world texture, follow [Adding a World Texture](assets.md#adding-a-world-texture). To use it as ground, give it a block type and add a ground layer to the zone's `ground`.
4. To add a zone, make a folder in [content/zones/](../content/zones/) with a zone file and its terrain images.

Run `npm run bake`, then `npm run bake -- --accept` once the change looks right, then `npm test` and `node js-tests/browser/run.js --covers zones`.
