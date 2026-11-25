# Zone Editor

The zone editor is a mode of the running game. It changes a zone's cubes and placements in place, over the zone's real light, fog and weathering, and its builder can leave the mode at any point to walk through the result. The development server holds each zone being edited in memory, bakes it again after every change and writes it back to `content/` only when the builder saves.

## Opening the Editor

1. Run `npm start`, which bakes the assets and starts the development server.
2. Open the game at `http://localhost:8080/` and enter the world.
3. Press **F8**. The simulation pauses, the HUD hides, and the camera flies from where it was.

F8 again, or the Play button, leaves the editor and lands the character where the camera looks. The address `?zone=hearthmere&edit` opens the game straight into the editor, `&view=x,y,z,yaw,pitch` places its camera, and `&bench=id` opens that object in the bench; a note's view uses the same form. On a static host the editor routes do not exist, so F8 reports that the editor needs the development server.

## Modes and Keys

The tool bar along the top switches between the modes, and holds undo, redo, the grid, save, New zone and play. A locked zone has Cubes, Select, Note and Brush modes; a zone whose terrain is not locked in yet has Terrain mode in place of Cubes. The palette on the left changes with the mode, the inspector on the right shows the selection, and the status line along the bottom shows the cell under the pointer, its height above the ground, its region and age, and the number of changes not saved.

| Key | Action |
|---|---|
| W A S D, Space, C | Fly forward, back, sideways, up and down; Shift flies faster |
| Drag with either button | Look around; in Brush mode the left button paints and the right button looks |
| 1, 2, 3, 4, 5 | Cubes, Select, Note, Terrain and Brush modes |
| Ctrl+Z, Ctrl+Y, Ctrl+S | Undo, redo and save |
| G | Outline every cube |
| B | Open the selected object in the bench, or go back to the world |
| F8 | Leave the editor |

### Cubes

Cube mode adds, removes and replaces cubes, the terrain's included, so the same tool digs a pond or raises a bank. A see-through box shows where a click acts. Add places cubes against the face under the pointer; Remove and Replace act on the cube itself. The brush places one cube, a square of 3 by 3 or 5 by 5 across the face, or, with Box, every cube between two clicked corners, up to 40,000 at once. Escape cancels a box.

The palette lists the block types by their file in `content/blocks/`, with a search and the blocks used most recently. The mouse wheel steps through the blocks shown, and a middle click picks the block of the cube under the pointer.

### Select

Select mode picks a placement: a prefab, a run such as a wall, an object, or a part of a building such as the inn's table. The inspector shows its corner cell, its turn and its size, and a gold outline marks it in the world.

| Key | Action |
|---|---|
| Arrow keys | Move the selection one cube, relative to the way the camera faces |
| Page Up, Page Down | Move it one cube up or down |
| R, Shift+R | Turn it a quarter turn one way or the other |
| Ctrl+D | Copy a placement one metre along x, without its id |
| Delete | Delete it |
| Ctrl+↑ | Select the building that a part belongs to |
| Escape | Clear the selection, or put away a capture box |

A name chosen in the palette's Prefabs, Objects or Buildings list makes the next click add that placement at the pointer, where a box shows the cells it will take; choosing it again, or Escape, returns to selecting.

#### Capture

Capture saves the cubes in a box as a new prefab or object, as a data file in `content/`. The steps:

1. Choose **Capture** in Select mode's tool bar.
2. Click one corner of the box's footprint, then the opposite corner. A click on the top of the ground marks the cube above it, so the box stands on the ground and leaves it out; Shift+Page Down later takes the ground in, as for a paved floor. The footprint lies flat at the lower corner's height.
3. Move the pointer up or down: the box's top follows it, starting at the highest cube in the footprint. Click to set it. Page Up or Page Down then moves the top a cube, and with Shift the bottom.
4. Name the piece, and choose **Save as prefab** or **Save as object**. Escape or Cancel puts the box away.

The box shrinks to the cubes it holds, without water. A placement's cubes are copied too, so a building's doorway can become a piece of its own. **Put the new piece in the cubes' place**, on by default, removes the cubes and places the new piece where they stood, as one step of the undo history; when a placement owns some of the cubes, they stay, and only the file is written.

| Saved as | Becomes | Size |
|---|---|---|
| Prefab | `content/prefabs/<name>.json`, a prefab at cube scale that places and turns like any other | At most 96 cubes a side |
| Object | `content/objects/<name>.json`, an object in which each cube becomes 8 × 8 × 8 fine cubes of its block, for detail in the bench | At most 8 cubes a side |

The server then runs the full bake, about 10 seconds, and the page loads again at the camera's view, so the palette lists the new piece; a new object opens in the bench. The zone's changes that are not saved stay in the server's session. The file stays when the step is undone.

### The Bench

The bench edits an object's fine cubes. **Open in the bench** in the inspector of a selected object, or B, opens it: the world gives way to the object alone, six times its size, on a floor ruled in world cubes under even light, and the camera flies around it as in the world. The block palette is Cubes mode's, so a block chosen in either is chosen in both.

| Tool | Effect |
|---|---|
| Add | Adds fine cubes of the chosen block against the face under the pointer, or on the floor |
| Remove | Removes the fine cubes under the pointer |
| Paint | Gives the fine cubes under the pointer the chosen block |
| Light | Marks the world cube that holds the clicked fine cube as one of the object's lights, or unmarks it; a gold outline shows each light |

The tool acts on one fine cube or a square of 3 by 3 or 5 by 5 across the face, and **Mirror X**, or M, repeats each change across the object's middle in x. The slider in the inspector hides the layers above a height, so a click reaches the inside of an object. The middle button picks the block of the fine cube under the pointer.

The bench keeps its own undo history, with Ctrl+Z and Ctrl+Y. **Save object**, or Ctrl+S, writes the object to `content/objects/<id>.json` for every copy in every zone, runs the full bake, about 10 seconds, and loads the page again at the world view where the bench opened. **Back to the world**, or B, returns without saving, and asks first when changes are not saved. The bench keeps the object's cells, whether it is solid and its light's colour; it does not resize an object.

### Notes

Note mode pins a note on the cube under a click. The note keeps the zone, the cell, the selection and the camera's view. A numbered pin marks each note; blue is open, gold is answered and grey is done. **N** moves the camera to the next note.

### Brush

Brush mode shapes and paints a locked zone's ground under a round brush. Pressing the left button starts a stroke and releasing it ends the stroke; the world shows each dab at once, and the whole stroke goes to the server as one step of the undo history. A ring on the ground shows the brush's reach. The tool bar chooses the brush, and the palette its settings: a circle, or a square whose side is twice the radius, the radius, and the brush's own settings. A square brush's strength falls off towards its sides as a circle's does towards its edge.

| Brush | Effect |
|---|---|
| Ground | Paints a ground on the top cube of each column: grass, moss, mud, sand, earth, cobble or rock, with the ground's under block in the earth and sand cubes up to three below it. Its edge is ragged, with a few stray cubes just outside it, or, with Clean, exactly the circle or the square. A column whose top cube a placement reaches down to stays as it is |
| Age | Weathers the columns towards an age from 0 to 100, by the strength at the middle and less towards the edge. A placement with its own `age` keeps it over its footprint. Grass, sand and mud do not weather, so the age shows on what stands on the ground and on stone |
| Sculpt | Raises, lowers, smooths or flattens the ground, by the strength at the middle and less towards the edge. A raised column keeps its top block on top; a lowered one takes its top block down, and the cells it leaves fill with water below the zone's water. Flatten levels towards the height where the stroke began. A column under a placement stays as it is, as the bake stands placements on the ground; a run such as a wall follows the ground, so it does not hold the ground under it, though its own cubes stay |

| Key | Action |
|---|---|
| [ and ], or the wheel | Make the brush smaller or larger, from 1 to 16 metres |

### Terrain

Terrain mode edits the zone's terrain recipe, which [Terrain Recipes](world.md#terrain-recipes) describes. The palette holds the base and its settings, the water level, the kind of each edge with its band, height and foot slope, and the features in the order they apply. A setting that another setting makes irrelevant, such as a flat area's height above the water while it matches the ground, is hidden, and some settings, such as the hills', explain themselves on hover. The inspector holds an overhead map of the zone with north at the top, its features outlined on it, a blue mark at the camera, and a red line where movement stops: 2 metres inside the zone's edge, and in front of the cliffs where they have risen 3 metres.

The map follows every change at once: the server runs the recipe at about 384 points a side and returns the picture, which takes about 0.15 seconds for a kilometre. The world does not change until the builder presses Preview, which sends the recipe as one step of the undo history; the server runs it at every column and bakes every region again, about 9 seconds for a kilometre, and the world reloads around the camera.

| Action | Effect |
|---|---|
| + Flat area, + Basin, + Rise, + Hilly area, then drag on the map | Adds the box dragged |
| + Hilly band, then click points on the map | Adds a band of hills along the points; a double click or Enter finishes it |
| + River, then click points on the map | Adds a river; a double click or Enter finishes it |
| + Pass, then click the map | Adds a pass that cuts straight to the nearest edge |
| Click a feature on the map, or in the list | Selects it and shows its settings |
| Click an empty spot on the map, when not drawing | Moves the camera there, at the same height above the ground or the water |
| Drag a feature, or a river's point | Moves it |
| ✕ beside a feature, or Delete | Removes it |
| Escape | Stops drawing |
| New seed | Gives the base a new seed |
| Lock in | Asks first, then writes the terrain as locked cubes and saves the zone |

Lock in is open only when the world shows the recipe the panel holds. It writes `regions/` and the zone file, removes the recipe, and runs the full bake; it cannot be undone. Cubes mode then takes the place of Terrain mode. The cube tool refuses changes before then, because the recipe would overwrite them.

### New Zones

New zone opens a form for the zone's id, name and size, 128, 256, 512 or 1,024 metres across. The new zone is 256 cells high with its base 48 cells up, takes the lighting of the zone open in the editor, and starts from rolling hills closed by cliffs on every side. It lives only in the server's session until the builder saves it: the server serves its baked files and adds them to the asset manifest it serves, so the game can load a zone the bake has not seen. The game then opens the new zone in the editor, with the camera above its middle looking north. A zone saved before Lock in keeps its recipe in its zone file, and the bake runs the recipe.

## How a Change Reaches the World

The editor sends each change to the development server, which applies it to the zone's source in memory, bakes the regions that the change touched, and serves those regions and the zone's index in place of the files in `assets/`. The game then loads the changed regions again. A cube appears at once, before the server answers; a placement moves when the bake returns, which takes about 0.15 seconds in Hearthmere.

Each request is one step of the undo history. Save writes the zone file, the changed locked regions and, after "Apply to all", the building layouts to `content/`, then runs the full bake. The baked files then differ from `assets.lock.json` until they are reviewed and accepted with `npm run bake -- --accept`.

The server reads the content code once, when a zone's session opens. After a change to a prefab, an object or a block type, restart the server.

## Owned Cubes

The bake records which placement set each cell. The cube tool changes only the zone's own cubes: the server refuses a cube that a placement owns, the editor puts it back, and the message names the owner. Selecting a prefab and choosing **Break apart into cubes** turns its cubes into the zone's own and its objects into the zone's own placements, at the same cells. Every other object standing within it, such as the chapel's pews and candles, keeps its height, which would otherwise be found from the top of the building's cubes. A building broken apart keeps no link to its type and takes the zone's age.

## Building Parts and Layouts

A building's parts are the objects its prefab places, numbered in the order the prefab lists them. Moving, turning or deleting a part changes that building only: the zone file's placement gains `parts`, which maps a part number to `null` for a deleted part or to `{ at, angle, on }`, the part's position in metres in the building's frame, its turn and how it stands. The inspector marks such a part as changed in this building only.

**Apply to all** moves a building's changed parts into `content/props/layouts.json`, keyed by the prefab, so every building of the type takes them; **Reset to the layout** removes the building's own changes. A building takes its type's layout first and its own parts after. Part numbers follow the prefab's list, so a change to that list moves the changes to other parts.

## Notes for Claude Code

The notes of each zone live in `local/notes/<zone>.json`, which Git ignores. A note is `{ id, cell, view, text, status, created, reply, selected }`, with `status` one of `open`, `answered` and `done`. [tools/notes.js](../tools/notes.js) reads them:

```sh
node tools/notes.js list [zone]
node tools/notes.js capture <zone> <id>
node tools/notes.js reply <zone> <id> <text>
```

`capture` opens the game in the headless browser at the note's view, from the saved content, with the note's card open, and saves the screenshot to `local/screens/note-<zone>-<id>.png`. `reply` adds the answer and marks the note answered; the builder marks it done in the game.

## Security

The development server listens on 127.0.0.1 alone. The editor's routes take a change only as a JSON request whose host name is `127.0.0.1` or `localhost` and whose origin, when it has one, is the server's own. A page on another site cannot send such a request without asking first, which the server never allows, and a host name that another site resolves to this machine is refused.

## Code

| File | Holds |
|---|---|
| [js/editor/edit-mode.js](../js/editor/edit-mode.js) | The mode: entering and leaving, picking, the request queue and reloading what the server baked |
| [js/editor/cube-tool.js](../js/editor/cube-tool.js), [select-tool.js](../js/editor/select-tool.js), [note-tool.js](../js/editor/note-tool.js), [terrain-tool.js](../js/editor/terrain-tool.js), [brush-tool.js](../js/editor/brush-tool.js) | The modes |
| [js/editor/brush-stroke.js](../js/editor/brush-stroke.js) | A brush stroke: the cells and ages its dabs change |
| [js/editor/bench.js](../js/editor/bench.js) | The bench: its scene, picking fine cubes, its tools and its own history |
| [js/editor/editor-panel.js](../js/editor/editor-panel.js), [marks.js](../js/editor/marks.js), [fly-camera.js](../js/editor/fly-camera.js) | The controls, the marks drawn in the world and the camera |
| [js/editor/editor-client.js](../js/editor/editor-client.js) | The requests to the server |
| [tools/editor/routes.js](../tools/editor/routes.js) | The server's editor routes and the baked files it serves |
| [tools/editor/session.js](../tools/editor/session.js) | A zone held in memory: its changes, the undo history, the partial bakes, saving, new zones, Lock in, capture and the bench's saves |
| [tools/terrain/](../tools/terrain/) | The terrain recipe's kinds and checks, the generator and the overhead map |
