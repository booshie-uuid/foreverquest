# Zone Editor

The zone editor is a mode of the running game. It changes a zone's cubes and placements in place, over the zone's real light, fog and weathering, and its builder can leave the mode at any point to walk through the result. The development server holds each zone being edited in memory, bakes it again after every change and writes it back to `content/` only when the builder saves.

## Opening the Editor

1. Run `npm start`, which bakes the assets and starts the development server.
2. Open the game at `http://localhost:8080/` and enter the world.
3. Press **F8**. The simulation pauses, the HUD hides, and the camera flies from where it was.

F8 again, or the Play button, leaves the editor and lands the character where the camera looks. The address `?zone=hearthmere&edit` opens the game straight into the editor, and `&view=x,y,z,yaw,pitch` places its camera; a note's view uses the same form. On a static host the editor routes do not exist, so F8 reports that the editor needs the development server.

## Modes and Keys

The tool bar along the top switches between three modes, and holds undo, redo, the grid, save and play. The palette on the left changes with the mode, the inspector on the right shows the selection, and the status line along the bottom shows the cell under the pointer, its height above the ground, its region and age, and the number of changes not saved.

| Key | Action |
|---|---|
| W A S D, Space, C | Fly forward, back, sideways, up and down; Shift flies faster |
| Drag with either button | Look around |
| 1, 2, 3 | Cubes, Select and Note modes |
| Ctrl+Z, Ctrl+Y, Ctrl+S | Undo, redo and save |
| G | Outline every cube |
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
| Escape | Clear the selection |

A name chosen in the palette's Prefabs, Objects or Buildings list makes the next click add that placement at the pointer; choosing it again, or Escape, returns to selecting.

### Notes

Note mode pins a note on the cube under a click. The note keeps the zone, the cell, the selection and the camera's view. A numbered pin marks each note; blue is open, gold is answered and grey is done. **N** moves the camera to the next note.

## How a Change Reaches the World

The editor sends each change to the development server, which applies it to the zone's source in memory, bakes the regions that the change touched, and serves those regions and the zone's index in place of the files in `assets/`. The game then loads the changed regions again. A cube appears at once, before the server answers; a placement moves when the bake returns, which takes about 0.15 seconds in Hearthmere.

Each request is one step of the undo history. Save writes the zone file, the changed locked regions and, after "Apply to all", the building layouts to `content/`, then runs the full bake. The baked files then differ from `assets.lock.json` until they are reviewed and accepted with `npm run bake -- --accept`.

The server reads the content code once, when a zone's session opens. After a change to a prefab, an object or a block type, restart the server.

## Owned Cubes

The bake records which placement set each cell. The cube tool changes only the zone's own cubes: the server refuses a cube that a placement owns, the editor puts it back, and the message names the owner. Selecting a prefab and choosing **Break apart into cubes** turns its cubes into the zone's own and its objects into the zone's own placements, at the same cells. A building broken apart keeps no link to its type and takes the zone's age.

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
| [js/editor/cube-tool.js](../js/editor/cube-tool.js), [select-tool.js](../js/editor/select-tool.js), [note-tool.js](../js/editor/note-tool.js) | The three modes |
| [js/editor/editor-panel.js](../js/editor/editor-panel.js), [marks.js](../js/editor/marks.js), [fly-camera.js](../js/editor/fly-camera.js) | The controls, the marks drawn in the world and the camera |
| [js/editor/editor-client.js](../js/editor/editor-client.js) | The requests to the server |
| [tools/editor/routes.js](../tools/editor/routes.js) | The server's editor routes and the baked files it serves |
| [tools/editor/session.js](../tools/editor/session.js) | A zone held in memory: its changes, the undo history, the partial bakes and saving |
