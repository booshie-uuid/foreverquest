# Workbench

The workbench is a page for looking at baked assets outside the game. It reads the same files the game reads, so it shows what the game will show. It holds a model viewer and a prop viewer, which the buttons at the top right switch between. The [zone editor](editor.md) is a mode of the game itself.

## Opening the Workbench

1. Run `npm start`, which bakes the assets and starts the development server.
2. Open `http://localhost:8080/tools/workbench/`.

The page lives in [tools/workbench/](../tools/workbench/), which only the development server serves. Its modules import game modules from `js/` and never import `content/`.

## Model Viewer

The model viewer shows one body at a time, from any rig, including creature bodies that the creator does not offer.

| Control | Effect |
|---|---|
| Body, Variant | Steps through every body in the library and the body's variants |
| Height, Build, Skin | Sets the sliders and the skin colour |
| Gear | For a body that wears parts: the default gear, a random set, or none |
| Idle, Walk, Run, Wave | Plays the rig's clips at standing, walking and running speed, and its wave action when it has one |
| Bones and boxes | Draws each joint as a small cube and each bone's box as an outline |
| Drag, mouse wheel | Turns the model and zooms |

The panel at the bottom right shows the rig, the number of bones and triangles, the sheet size and the model's height.

The page keeps the view in its address, such as `?body=wolf&overlay=bones&yaw=1.1`, so a link or a reload opens the same view.

## Prop Viewer

The prop viewer, at `?view=props`, shows one prefab at a time. The Prefab stepper steps through every prefab in alphabetical order, and "Colliders and lights" outlines each collider on the ground and marks each light spot. Drag turns the prop and the mouse wheel zooms. The address keeps the view, such as `?view=props&prefab=house.inn&overlay=1`.

## Capturing a View

The capture command bakes, opens the workbench in the headless browser that the browser tests use, and saves a screenshot to `local/screens/workbench-<name>.png`:

```bash
node tools/workbench/capture.js wolf "body=wolf&overlay=bones&yaw=1.1"
```

The first argument names the file, and the second is the address query. The command fails if the page reports an error. Claude Code uses it to look at the content it authors.
