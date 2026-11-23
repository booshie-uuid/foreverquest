# ForeverQuest

ForeverQuest is a proof of concept for a browser role-playing game in the style of early online RPGs. It has a character creator and a small village to walk around. Every model and every texture in it is made by code, not drawn by hand, so new art is a code change. Authoring code in [content/](content/) is baked into asset files that the game loads. The world textures, every part of the characters, the props and the zones are baked; the game generates no art when it runs. A workbench page shows baked models outside the game.

The game runs on HTML5 and WebGL. Its only runtime library is [Three.js](https://threejs.org/) 0.187, which renders the scenes. A copy of Three.js sits in [libs/three/](libs/three/), so the game runs without an install step.

## Running the Game

1. Install [Node.js](https://nodejs.org/) 24 or later.
2. Run `npm start` in the project folder. The command bakes the assets into `assets/`, then starts [tools/serve.js](tools/serve.js), a static file server with no dependencies, on port 8080.
3. Open `http://localhost:8080` in a browser.

The page loads its scripts as ES modules, and browsers do not load modules from `file://` addresses, so opening `index.html` straight from disk does not work. Any static file server works in place of `npm start`, once `npm run bake` has built the assets.

After a change to the Three.js version in `package.json`, run `npm install` and then `npm run vendor`, which copies the new build into `libs/three/`.

## Controls

| Screen | Input | Action |
|---|---|---|
| Creator | Drag the preview | Turns the character |
| Creator | Idle, Walk, Run, Wave | Plays an animation on the preview |
| Creator | Body, Face | Frames the whole body or the face |
| World | Click the ground | Walks to that spot |
| World | Click a villager | Walks to the villager and talks |
| World | W A S D | Walks relative to the camera |
| World | Drag, or the arrow keys | Turns and tilts the camera |
| World | Mouse wheel | Zooms the camera |
| World | R | Switches between walking and running |
| World | E | Waves |
| World | Appearance button | Opens the creator |
| Both | Retro | Renders 640 pixels wide and scales the picture up with hard pixel edges |

Two address options help testing: `?zone=testfield` or `?zone=expanse` starts in another zone, and `?stats` shows the frame rate, the triangles and draw calls of the last frame, and the regions loaded.

Mirelle, the tailor in the village square, also opens the creator. The creator saves the character to the browser's `localStorage` when the player enters the world or saves changes.

## Character Customisation

| Option | Choices |
|---|---|
| Race | Human, Elf, Dwarf, Halfling, Orc |
| Body | Male, Female |
| Height, Build | Sliders: height scales the character, build widens the torso and limbs |
| Skin | Four to six tones, from a palette that belongs to each race |
| Face | Stern, Weary, Gaunt, Broad, Young, Grim |
| Nose | Straight, Small, Broad, Hooked, Long |
| Eyes | Seven colours |
| Hair | Nine styles in 11 colours |
| Beard | None, Stubble, Moustache, Short, Full, Long, Forked |
| Markings | None, Scar, Weathered, War Paint, Tattoo |
| Equipment | Eight slots: head, chest, legs, feet, hands, back, main hand and off hand |

Each equipment item has a main colour and, for most items, a trim colour. Cloth and leather take colours from a cloth palette, and armour takes colours from a metal palette. The palettes, races and items are all content in [content/](content/).

A race changes proportions as well as size. A dwarf has a wide torso and short legs, an elf is tall and narrow with long ears, a halfling is small, and an orc is broad, with tusks and swept-back ears.

## Art Style

Characters and props are built from rigid, textured blocks, in the spirit of Minecraft and Lego but with a darker palette and a serious tone. Four rules make up the style.

- Rigid blocks. A character is six boxes, for the head, torso, arms and legs, plus clip-on blocks such as hair, beards, helmets, pauldrons, cloaks and weapons. Each block turns at one joint and never bends, so nothing stretches or clips.
- Pixel textures. Every face of every block carries a pixel-art texture at one density: 16 texels across a head, about 2 centimetres a texel. The textures are painted in code at load, with nearest filtering.
- Heroic proportions. The head is about 1/5.5 of a character's height, large enough for a readable face at play distance.
- A dark mood. Muted earth colours, fog, cold moonlight with shadows, and warm lamplight from windows, lanterns and lamp posts.

The Retro toggle renders at 640 pixels wide and scales the picture up with hard pixel edges.

## How a Character Is Built

The character system turns an appearance record into a few blocks, one texture sheet and one mesh per joint. The diagram below shows the modules involved, from the record on the left to the animated model on the right.

```mermaid
flowchart LR
    accTitle: Character Build Pipeline
    accDescr: An appearance record becomes body blocks, part blocks and paint layers, the sheet packs and paints every block face, and the model merges the blocks of each joint into one mesh for the animator to turn

    appearance[(Appearance record)]

    subgraph plan_stage ["Plan"]
        kit[List blocks]
        outfit[Layer paint]
    end

    subgraph paint_stage ["Paint"]
        sheet[Pack and paint sheet]
    end

    model[Merge blocks per joint]
    animator([Turn joints])

    appearance --> kit
    appearance --> outfit
    kit --> sheet
    outfit --> sheet
    sheet --> model
    model --> animator
```

1. [Appearance](js/character/appearance.js) holds the player's choices. It checks every change against the catalogue and tells its listeners when the record changes.
2. The [fitter](js/kit/fitter.js) sizes the body blocks from the body's sizes, its variant and the sliders, and places them on the bones of the body's rig. The [dresser](js/kit/dresser.js) lists the blocks of each part the character wears, such as the nose, ears, hair, beard and equipment, and the paint layers for each body block face: skin first, then the face, clothing and armour.
3. [Sheet](js/character/sheet.js) packs every face of every block into one texture, and the [compositor](js/kit/compositor.js) paints each face from baked stamps: rectangles of texels that the bake paints once, in the colours the character chooses.
4. [CharacterModel](js/character/character-model.js) merges the blocks of each joint into one mesh with [BlockBuilder](js/geometry/block-builder.js), and gives the character one material. The model rebuilds itself whenever the appearance changes.

A character has about 130 to 300 triangles and a sheet 256 texels wide. The [clip player](js/kit/clip-player.js) poses the model by turning its joints each frame from baked clips in [content/clips/](content/clips/): legs and arms swing from the hips and shoulders, the head turns, and a cape swings back as the character moves. The humanoid clips have idle, walk, run and a wave; the wolf's have idle, walk and run.

Equipment works in two ways. Most items repaint body faces, so a shirt paints the torso and upper arms and boots paint the lower legs. Items that change the silhouette add blocks: helmets, hoods, hats, pauldrons, coat tails that hang from each leg, cloaks, packs, weapons, shields and a lantern that glows.

## Adding Content

A new hair style, item or race is a catalogue entry and a few blocks. A block is `{ joint, size, at, faces, rotation }`: its size and centre are in texels, its centre is relative to the joint, and `faces` maps face names (`front`, `back`, `left`, `right`, `top`, `bottom`, or `all`) to painters.

A hair style, an item or a face is a part: one file, or one entry in a family file, in [content/parts/](content/parts/). A part names the stamps that paint body faces and lists the blocks it adds, each hung from a socket such as the head or a hand. [docs/character-kit.md](docs/character-kit.md#adding-content) gives the steps. After a change, run `npm run bake`, check the result in the workbench, accept it with `npm run bake -- --accept`, and run `npm test`. The character model test builds every option for every race and body type, and fails on a vertex that is not a number, a UV off the sheet, more than 1,200 triangles or a sheet taller than 512 texels.

To add a race, add a body file to [content/bodies/](content/bodies/) with its box sizes in texels, its ears and its skin tones, then bake. Add name syllables to [names.js](js/character/names.js), or the race's random names use the human syllables. A creature with a new shape is a rig in [content/rigs/](content/rigs/) and a body on it; the wolf is an example. [docs/character-kit.md](docs/character-kit.md) describes rigs and bodies.

To add a world texture, add a name, a seed and a painter to `TEXTURES` in [content/world-textures.js](content/world-textures.js), then bake. A world texture is 64 by 64 texels and covers four world cubes each way, 1 1/3 metres; its painters are in [content/art/surfaces.js](content/art/surfaces.js). [docs/assets.md](docs/assets.md) describes the bake.

## The World

The village of Hearthmere is a zone folder, [content/zones/hearthmere/](content/zones/hearthmere/): 96 metres square, built from cubes 1/3 metre on a side, with ground of grass, moss, mud, cobble, sand or stone and the props placed on it. Under the ground lie earth and rock, and the faces of tall drops show rock.

Every prop is a prefab built from textured blocks by [content/art/props.js](content/art/props.js), which the bake turns into cubes: jettied timber houses on stone plinths with stepped slate or thatch roofs, stone cottages, a chapel with a bell tower, a graveyard, a well, lamp posts, stocks, a cart, barrels, crates, sacks, fences, a signpost, a gibbet, pines, oaks, dead trees, rocks, bushes and weeds. The game draws the ground in chunks of 32 cubes each way, and every world block shares one material, which reads its textures from one texture array.

Characters can step up one cube at a time, and cannot enter the lake. Fourteen villagers walk around the village. Seven have set appearances and lines in [content/npcs/](content/npcs/). The other seven come from the same random generator as the creator's Randomise button. [docs/world.md](docs/world.md) describes zones.

## Project Layout

| Folder | Holds |
|---|---|
| [js/art/](js/art/) | The colour maths the compositor uses |
| [js/geometry/](js/geometry/) | BlockBuilder, which turns blocks into meshes |
| [js/kit/](js/kit/) | The library of baked content, the fitter, the dresser, the compositor, the stamp sheet and the clip player |
| [js/character/](js/character/) | The appearance record, the names, the texture sheet, the character model and the placeholder painter |
| [js/sim/](js/sim/) | The simulation: entities, villager behaviour, a zone's data and collision, on a fixed tick and without a renderer |
| [js/render/](js/render/) | The views: a zone's chunked terrain and prop meshes, water, sky and lights, and each entity's model between ticks |
| [js/game/](js/game/) | The game screen, camera, input and the in-game HUD |
| [js/ui/](js/ui/) | The character creator and its controls |
| [js/engine/](js/engine/) | The WebGL renderer loop, the asset source and PNG decoder, the world atlas and material, the raster and the graphics settings |
| [content/](content/) | Authoring code and data that the bake turns into assets: painters, stamps, rigs, bodies, parts, palettes, archetypes and the id migrations |
| `assets/` | The baked asset files, which the bake rebuilds and Git ignores |
| [js-tests/](js-tests/) | The unit and browser test suites |
| [lint/](lint/) | The project's ESLint rules |
| [tools/](tools/) | The bake, the workbench, the static file server and the Three.js copy script |

## Documentation

The [docs/](docs/) folder describes the architecture, the assets and the bake, the character kit, the workbench and the world in more depth.

## Tests and Lint

| Command | Effect |
|---|---|
| `npm install` | Installs ESLint and Three.js for the tests and the lint |
| `npm run bake` | Bakes `content/` into `assets/`; `-- --accept` records the result in the lock file, and `-- --watch` bakes on every change |
| `npm test` | Bakes, then runs the unit suite and the lint tests |
| `npm run test:browser` | Plays the game in headless Chrome or Edge |
| `npm run lint` | Checks the code against the coding style |

[js-tests/README.md](js-tests/README.md) explains the test suites, and [lint/README.md](lint/README.md) lists the lint rules.

## Limitations

The project is a proof of concept, and it leaves out most of a game.

- Villagers walk in straight lines and stop at the first obstacle. The player's click-to-move finds a route, but only within about 6,000 columns of searching.
- Characters walk through each other.
- Equipment is cosmetic. The game has no combat, inventory or stats.
- The game has no server, so it has no other players.
