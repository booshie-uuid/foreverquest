# Assets and the Bake

ForeverQuest separates the code that makes art from the code that plays the game. Authoring code in [content/](../content/) paints and builds the art. The bake runs that code and writes asset files into `assets/`. The game reads only those files, so it holds no painter or generator for anything that has been baked.

Everything the game draws is baked: the world textures, everything that makes up a character (rigs, bodies, parts, stamps, clips, palettes, archetypes and appearance defaults), the prop prefabs, the zones and the villagers.

## The Boundary

The diagram shows the route from authoring to play. The asset files are the only route.

```mermaid
flowchart LR
    accTitle: Authoring and Play Boundary
    accDescr: Content sources pass through the bake into asset files, and the game reads only the asset files

    content[(Content sources)]
    bake[Bake content]
    assets[(Asset files)]
    game([Game])

    content --> bake
    bake --> assets
    assets --> game
```

| Folder | Holds | Read by the game |
|---|---|---|
| [content/](../content/) | Authoring code and data, such as the world texture painters, the rigs and the bodies, and the id migrations | No |
| [tools/bake/](../tools/bake/) | The bake and the PNG writer | No |
| `assets/` | The baked files and their manifest. Git ignores the folder, because the bake rebuilds it | Yes |
| [assets.lock.json](../assets.lock.json) | A hash of every baked file and every content id, under version control | No |

The lint enforces the boundary:

- A module under `js/` cannot import from `content/` or `tools/`.
- A module under `js/sim/` cannot import Three.js or a module from `js/engine/`, `js/render/` or `js/ui/`, and cannot use a page global such as `window` or `document`.
- A module under `content/` or `tools/bake/` cannot call `Math.random`, `Date.now` or `performance.now`, or create a `Date`, so every bake writes the same files.

Content may import game modules, such as the colour maths in [js/art/](../js/art/). The authoring painters live in [content/art/](../content/art/).

## Running the Bake

| Command | Effect |
|---|---|
| `npm run bake` | Bakes `content/` into `assets/` and reports any file that differs from the lock file |
| `npm run bake -- --accept` | Bakes, then writes the lock file from the result |
| `npm run bake -- --watch` | Bakes, then bakes again each time a file under `content/` or `js/` changes |

`npm start`, `npm test` and the browser test runner bake first, so the game and the tests never read stale assets. The watch mode runs each bake in a new Node process, because Node keeps the modules a process has imported and would not see the change.

## The Lock File

The lock file records what the owner has accepted. After each bake, the asset lock test compares `assets/manifest.json` with `assets.lock.json` and fails when a file was added, changed or removed. An art change is therefore deliberate:

1. Change the content and run `npm run bake`. The bake lists the files that differ from the lock file.
2. Review the changed assets, for example by opening the PNG files or running the game.
3. Run `npm run bake -- --accept` to record the change, and commit the lock file with the content change.

## Ids and Migrations

The lock file also records every content id by kind: each world texture, rig, body, stamp, part, clip, action, prefab, zone and villager, each part as `slot/id`, and each body's variants as `body/variant`. A bake fails when an id that the lock file records is gone, unless [migrations.js](../content/migrations.js) maps it to a replacement that still exists. The bake writes the maps to `migrations.json`, and saved characters load through them.

```javascript
export const IDS =
{
    "world-texture": { turf: "grass" },
};
```

## Asset Files

| File | Holds |
|---|---|
| `manifest.json` | Each file's SHA-256 hash and size, and the ids by kind |
| `textures/world.png` | Every world texture, 64 by 64 texels, stacked top to bottom in atlas order |
| `textures/world.json` | The texture size, the texels per metre, and each layer's name and glow flag |
| `blocks.json` | Every block type in baked order, with its kind, its light and the textures of its top, sides and bottom |
| `models/index.json` | The rig ids, and the body ids in display order |
| `models/rigs/<id>.json` | A rig, with each pivot and centre compiled into a linear form of box sizes |
| `models/bodies/<id>.json` | A body, checked against its rig |
| `models/stamps.png`, `models/stamps.json` | Every stamp packed into one sheet, and each stamp's rectangle and whether it takes a tint |
| `models/parts/index.json`, `models/parts/<slot>/<id>.json` | The part ids in each slot's order, and each part checked against the rigs that offer its slot |
| `models/stamps.preview.png` | A viewable copy of the stamp sheet, which the game does not read |
| `models/clips/index.json`, `models/clips/<rig>.json` | The rigs that have clips, and each rig's clips and actions |
| `models/palettes.json`, `models/archetypes.json`, `models/appearance.json` | The colour palettes, the villager archetypes, and the appearance defaults and random rules |
| `objects.json` | Every fine-cube object: its cells, whether it is solid, the block types it uses, and its fine cubes as runs of block and count |
| `props/prefabs.json` | Every prefab's blocks, colliders and light spots |
| `zones/index.json`, `zones/<id>/index.json`, `zones/<id>/<x>-<z>.bin` | The zone ids, each zone's settings and props with its runs built, and its compressed region files |
| `npcs.json` | Every villager, and the shared lines crowds say |
| `migrations.json` | The id maps from [migrations.js](../content/migrations.js) |

Texels are stored as 8-bit RGBA PNG, so any image viewer opens them. The bake writes PNG with Node's built-in `zlib` and no row filters, so the same texels always give the same bytes.

## Loading Assets

[AssetSource](../js/engine/asset-source.js) reads baked files through a function that returns raw bytes. In the browser, `AssetSource.http("assets/")` fetches them. The unit tests open the same files from disk with [js-tests/helpers/assets.js](../js-tests/helpers/assets.js). The source reads the manifest first and refuses a path that the manifest does not list.

The game decodes PNG itself in [png.js](../js/engine/png.js), with the `DecompressionStream` that both browsers and Node provide. A browser's image decoder may convert colour spaces or premultiply alpha, which would change the texels.

[Library](../js/kit/library.js) loads the rigs, the bodies and the id maps. [WorldAtlas](../js/engine/world-atlas.js) loads the world texture image and index. It maps texture names to layers, lists the glow layers for the world material, and flips each layer's rows for upload, because images store rows top-down and textures upload them bottom-up.

## Adding Content

[Character Kit](character-kit.md#adding-content) describes how to add a race or a creature. The [workbench](workbench.md) shows baked bodies before they reach the game.

## Adding a Block Type

A block type is one world cube's material. The files in [content/blocks/](../content/blocks/) each export `BLOCKS`, a map from block id to its definition:

| Field | Meaning |
|---|---|
| `faces` | World texture names for `top`, `side` and `bottom`; `all` covers the faces that are not named |
| `kind` | `solid` (the default) blocks movement and hides the faces behind it; `clear` blocks movement and lets the faces behind it show, as leaves do; `liquid` lets entities enter it |
| `light` | The light the block gives, from 0 (the default) to 15 |

[BlockSet](../js/sim/block-set.js) numbers the block types from 1 in the baked order, file by file in name order, and keeps 0 for air. The simulation and the views both read it. The bake fails on a repeated id, an unknown texture, face or kind, a block without a texture on every face, or a light out of range.

## Adding an Object

An object is a thing built from fine cubes, eight to a world cube's edge, such as the cart. The files in [content/objects/](../content/objects/) each export `OBJECTS`, a map from object id to its definition:

| Field | Meaning |
|---|---|
| `cells` | `[width, height, depth]` in world cubes, each from 1 to 8 |
| `build(object)` | Fills fine cubes with `object.box(from, to, block)`, from one corner up to but not including the other, or `object.set(x, y, z, block)`, counted from the object's lower corner |
| `isSolid` | `false` lets entities walk through the object; it defaults to `true` |

A fine cube takes the textures of its block type, so a timber fine cube shows end grain on top. The bake fails on a fine cube outside the object's cells, so an object never reaches beyond the cubes it claims; on an unknown block; and on a mesh of more than 6,000 triangles. The bake writes the fine cubes to `objects.json`, not the mesh, because the cubes compress to a fraction of the mesh's size. The game builds each object's mesh once at load with [js/render/fine-mesher.js](../js/render/fine-mesher.js), which merges the faces of each texture into rectangles; the bake uses the same module to count the triangles. To place an object, add `{ object, x, z, angle }` to a zone's `props`; [World](world.md#fine-cube-objects) describes placement.

## Adding a World Texture

1. Add an entry to `TEXTURES` in [content/world-textures.js](../content/world-textures.js) with a `name`, a whole-number `seed` that no other texture uses, a `paint` function from [content/art/surfaces.js](../content/art/surfaces.js), and `glow: true` if the texture lights itself.
2. Run `npm run bake`, check the new layer in `assets/textures/world.png`, then run `npm run bake -- --accept`.

Each texture has its own seed, so adding or moving a texture leaves the texels of the others unchanged. The bake fails on an invalid or repeated name, a missing seed or a texel that is not opaque.
