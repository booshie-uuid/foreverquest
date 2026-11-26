# ForeverQuest

ForeverQuest is a proof of concept for a browser role-playing game in the style of early online RPGs. The longer term ambition for the project is for a community built world of adventures, but the project is in its early days and at this stage it is just an evolving tech demo. To enable community driven content, the game builds on the legacy of games like Infiniminer and Minecraft with a world built from easy to work with cubes, but introduces new depth by allow cubes to be divided in to "fine cubes" for greater control over detail. It aims to strike the balance between easy of creation and accessible performance by finding a happy medium between cubes and voxels.

The engine and game is designed to run on HTML5 and WebGL. At this stage its only runtime dependency is [Three.js](https://threejs.org/) (0.187).

## Generative AI Disclaimer

ForeverQuest started as a learning exercise on how to work effectively with Generative AI & Agentic Coding. Unless otherwise stated (and excluding 3rd-party libraries), it should be assume that all code and graphical assets are AI generated.

## Running the Game Locally (for Developers & Content Creators)

For performance reasons, all content is "baked" in to more efficient meshes and objects, so to create new content you need to run the game locally.

1. Install [Node.js](https://nodejs.org/) 24 or later.
2. Run `npm start` in the project folder. The command bakes the assets into `assets/`, then starts [tools/serve.js](tools/serve.js), the development server, on port 8080. It serves the files and the zone editor's routes.
3. Open `http://localhost:8080` in a browser.

The page loads its scripts as ES modules, and browsers do not load modules from `file://` addresses, so opening `index.html` straight from disk does not work. Any static file server can be used to run the game in place of `npm start` once `npm run bake` has built the content, however `npm` is required to run the content editor.

After a change to the Three.js version in `package.json`, run `npm install` and then `npm run vendor`, which copies the new build into `libs/three/`.

## Documentation

The [docs/](docs/) folder describes the architecture, the assets and the bake, the character kit, the workbench, the zone editor and the world in more depth.

## Tests and Tooling

| Command | Effect |
|---|---|
| `npm install` | Installs ESLint and Three.js for the tests and the lint |
| `npm run bake` | Bakes `content/` into `assets/`; `-- --accept` records the result in the lock file, and `-- --watch` bakes on every change |
| `npm test` | Bakes, then runs the unit suite and the lint tests |
| `npm run test:browser` | Plays the game in headless Chrome or Edge |
| `npm run lint` | Checks the code against the coding style |

[js-tests/README.md](js-tests/README.md) explains the test suites, and [lint/README.md](lint/README.md) lists the lint rules.
