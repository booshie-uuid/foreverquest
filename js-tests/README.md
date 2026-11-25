# Tests

The project has two test suites. The unit suite runs plain modules in Node. The browser suite drives Chrome or Edge through the Chrome DevTools Protocol and plays the real game page.

## Unit Suite

Run `npm test`. It bakes the assets, then runs the `node:test` files that match `js-tests/unit/**/*.test.js`, and the lint tests in `lint/tests/`. A unit test imports `node:test` and `node:assert/strict`. Three.js runs in Node without WebGL, so the unit suite builds real character models, sheets and the world, and checks their geometry and texels. A test that needs baked assets opens them from disk with [helpers/assets.js](helpers/assets.js). A test never runs the bake itself, because the test files run in parallel and a bake rewrites `assets/`.

The asset lock test fails when `assets/` differs from `assets.lock.json`; [Assets and the Bake](../docs/assets.md#the-lock-file) describes how to accept a change. The reference test compares the game with data recorded from the prototype in [reference/prototype.json](reference/prototype.json), so the restructure can prove that it reproduces the prototype. The texel grew from the prototype's 1.8/88 metre to 1/48 metre, so the tests multiply the recorded lengths and speeds by `Capture.GROWTH`. The world textures were repainted at the new density, so the reference no longer holds them. [reference/capture.js](reference/capture.js) holds the capture functions; update them when an interface they call changes, and never re-record the reference. A deliberate change to what the prototype built goes in [reference/departures.js](reference/departures.js), which moves the recorded blocks to where the change puts them, such as poles held in front of the arm and short noses moved down from the eye line. [reference/prototype-motion.json](reference/prototype-motion.json) holds the prototype animator's joint angles for the cases in [reference/motion.js](reference/motion.js), which the clip test compares the clip player with.

## Browser Suite

| Command | Effect |
|---|---|
| `npm run test:browser` | Runs every spec in `js-tests/browser/specs/` |
| `node js-tests/browser/run.js --covers <tag>` | Runs only the specs whose `covers` list holds the tag |
| `--headed` | Shows the browser window instead of running headless |
| `--keep-screens` | Keeps the screenshots of passing tests |

The runner ([run.js](browser/run.js)) bakes the assets, starts the static server ([tools/serve.js](../tools/serve.js)) on a random port and launches one browser. Each test gets a new page in its own browser context, so cookies and `localStorage` never carry over from another test. The driver ([cdp.js](browser/cdp.js)) uses `CHROME_PATH` when it is set, and otherwise looks for Chrome, then Edge, in their standard install folders. The browser renders WebGL with SwiftShader (`--use-angle=swiftshader --enable-unsafe-swiftshader`), so the suite needs no GPU. The viewport is 1280 × 800 at a device pixel ratio of 1.

A test fails when it throws, when it runs longer than 60 seconds (or the test's own `timeout` in milliseconds), or when the page reports an error. Page errors are uncaught exceptions, `console.error` and failed `console.assert` calls, failed resource loads other than `/favicon.ico`, and a page crash.

`screenshot(name)` saves `local/screens/<spec>-<name>.png`. The runner deletes the screenshots of a passing test unless `--keep-screens` is set. When a test fails, the runner saves `local/screens/<spec>-<test>-failure.png`.

### Writing a Spec

A spec exports the tags it covers and a list of tests:

```javascript
import * as assert from "node:assert/strict";

export const covers = ["boot"];

export const tests =
[
    {
        name: "boots the game",
        run: async ({ page, baseUrl, screenshot }) =>
        {
            await page.goto(baseUrl + "/index.html");
            await page.waitFor(() => window.foreverQuest?.isReady === true);

            assert.ok(await page.evaluate(() => document.querySelector("canvas") !== null));
            await screenshot("boot");
        },
    },
];
```

### Page API

| Member | Effect |
|---|---|
| `goto(url, { timeout })` | Navigates and waits for the load event |
| `evaluate(fnOrExpression, ...args)` | Runs code in the page, awaits a promise, and returns the result by value. Arguments must be JSON-serialisable. A page exception is thrown with its message and stack |
| `waitFor(fnOrExpression, { timeout, interval })` | Polls until the result is truthy and returns it. Defaults: 10 000 ms and 50 ms |
| `click(selector)` | Scrolls the element into view and clicks its centre |
| `clickAt(x, y, { button })` | Sends real mouse events, so canvas pointer handlers fire |
| `mouseDrag(x1, y1, x2, y2, { button, steps })` | Presses, moves in steps (default 10) and releases |
| `wheel(x, y, deltaY)` | Sends a wheel event at the point |
| `keyDown(key)`, `keyUp(key)`, `press(key, holdMs)` | Sends key events for letters, digits, arrows, `Enter`, `Escape`, `Space` (or `" "`), `Tab`, `Backspace` and `Shift` |
| `screenshot(path)` | Saves a PNG of the viewport |
| `errors` | The page errors collected so far, as strings |

The mouse `button` option is `"left"` (the default), `"right"` or `"middle"`.

## When to Run What

| When | Command |
|---|---|
| After every change | `npm test` |
| While working on a capability | `node js-tests/browser/run.js --covers <tag>` |
| Before finishing a change | `npm run test:browser` |

## Capability Map

Each tag names one capability of the game. A spec lists its tags in `covers`.

| Tag | Covers | Specs |
|---|---|---|
| `assets` | The browser decodes the baked world textures to the same texels as Node, and the loading state clears | [assets.spec.js](browser/specs/assets.spec.js) |
| `boot` | The game page loads without errors, sets `window.foreverQuest.isReady`, and shows a canvas with a non-zero size | [smoke.spec.js](browser/specs/smoke.spec.js) |
| `creator` | The creator draws the preview, rebuilds the character when an option changes, keeps the skin within the race's palette, repaints the character sheet for a marking, equips and tints items, randomises the look, and blocks an invalid name | [creator.spec.js](browser/specs/creator.spec.js) |
| `editor` | F8 opens the editor over the paused game and lands the player where the camera looks; a click adds a cube that the server bakes and serves, and undo removes it; selecting the well and pressing the up arrow moves it a cube away from the camera; a note keeps the camera's view and shows a pin; the brush paints sand with a clean edge, weathers the ground and raises it with a square brush, one step a stroke, while a right-drag still looks; Capture takes a footprint on the ground from two clicked corners and a top that follows the pointer, Page Up raises it, and Cancel puts it away; a prefab chosen to add shows its size at the pointer; a new zone opens in Terrain mode with its map drawn, takes a flat area dragged on the map without moving the camera, moves the camera to an empty spot clicked on the map, and Preview bakes a changed base into the world | [editor.spec.js](browser/specs/editor.spec.js) |
| `graphics` | A sealed room with every light out, the player's too, stays bright enough to make out; the terrain carries light levels and the coloured glow and the player takes its cell's light, the Day toggle brings up the sun, the moonlight casts shadows from the player in the world, windows are see-through glass that casts no shadow, lights draw halos by night, every one of them in one draw call, and none by day, height fog compiles into the terrain's shader, and the Grid toggle outlines the cubes | [graphics.spec.js](browser/specs/graphics.spec.js) |
| `workbench` | The model viewer opens a creature on its own rig from the address, stepping the body switches rigs and updates the address, and the prop viewer shows a prefab with its colliders and lights | [workbench.spec.js](browser/specs/workbench.spec.js) |
| `zones` | The game starts in the zone the address names, the zone picker travels to the zone chosen, and travelling loads the next zone, frees the last and keeps the player | [zones.spec.js](browser/specs/zones.spec.js) |
| `streaming` | A kilometre zone loads only the regions around the player, follows the player across it, and stays within 1,000,000 triangles and 400 draw calls; `?stats` shows the frame rate | [streaming.spec.js](browser/specs/streaming.spec.js) |
| `movers` | Clicking the lever in the test field walks the player to it, raises the portcullis and opens the archway | [movers.spec.js](browser/specs/movers.spec.js) |
| `world` | Entering the world shows the villagers and their nameplates; keys move the player and a ground click does not; talking to the tailor opens the creator, and saving restyles and stores the player; the game starts in first person and the wheel zooms out to third person; holding both mouse buttons walks forward; right-clicking a block names its prop; walking through a kit house's door in the Expanse leads into its room, where walls pull the camera in | [world.spec.js](browser/specs/world.spec.js) |

## Conventions

- Name a spec `<capability>.spec.js`, and add each tag it covers to the capability map.
- Wait for `window.foreverQuest.isReady` before interacting with the game.
- Drive player actions with real input (`click`, `clickAt`, `mouseDrag`, `press`), and read game state with `evaluate`.
- Measure game time in ticks, not seconds. Pause the simulation with `foreverQuest.game.pause()`, give the input, then advance it with `foreverQuest.game.stepTicks(count)`, at 20 ticks a second. A spec that waits in real time depends on the frame rate under software rendering.
- Code inside an `evaluate` or `waitFor` callback runs in the page. The lint gives `js-tests/browser/` both Node and browser globals for this reason.
- Write test output to `local/`, which git ignores.

## Lessons

This section records a testing practice when a bug got past both suites and the practice would catch other bugs of the same kind.

### Measure What the Renderer Drew

A browser test of something drawn measures what the renderer drew, such as the triangles in `renderer.info.render` or the pixels of the frame, not the data the code handed to Three.js. The halos once passed every test while Three.js drew only the first 64 of Hearthmere's lights: the instance data was right, but the geometry kept the instance count it was first drawn with as its limit.
