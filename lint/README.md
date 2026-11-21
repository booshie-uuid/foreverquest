# Lint

ESLint checks the mechanical rules of the [coding style](../.claude/rules/coding-style.md). The configuration is in [eslint.config.js](../eslint.config.js), and the project's own rules are in this folder.

## Commands

| Command | Effect |
|---|---|
| `npm run lint` | Lints every `.js` file outside `node_modules/`, `libs/`, `local/` and `assets/` |
| `npx eslint . --fix` | Corrects what the rules can fix, such as quotes, semicolons and banner widths |
| `node --test "lint/tests/**/*.test.js"` | Runs the lint tests, which `npm test` also runs |

## Rules

| Rule | Enforces | Source |
|---|---|---|
| Recommended rules | Correctness basics, such as `no-undef` and `no-unused-vars` | ESLint |
| `@stylistic/brace-style` | Allman braces; a block may sit on one line | @stylistic |
| `@stylistic/keyword-spacing` | No space between `if`, `for`, `while` or `switch` and `(`; a space after other keywords | @stylistic |
| `@stylistic/quotes` | Double quotes, or single quotes that avoid an escape | @stylistic |
| `@stylistic/semi` | A semicolon after every statement | @stylistic |
| `@stylistic/comma-dangle` | A trailing comma after the last item of a list that spans lines | @stylistic |
| `no-underscore-dangle` | No `_` at the start or end of a name, including methods, fields and parameters | ESLint |
| `sort-imports` | Sorted import statements, and sorted names inside each pair of braces | ESLint |
| `no-console` | No `console` call outside `js/log.js` | ESLint |
| `local/banner-width` | Banner comments that end at column 80 | Project |
| `no-restricted-imports` | No import of `content/` or `tools/` from `js/` or `tools/workbench/page/`, and no import of Three.js or a render, engine or UI module from `js/sim/` | ESLint |
| `no-restricted-properties`, `no-restricted-syntax` | No `Math.random`, `Date.now`, `performance.now` or `new Date()` in `content/` or `tools/bake/` | ESLint |

The `@eslint/js` package is not installed, so the configuration builds the recommended set from the core rules that ESLint marks as recommended. The configuration switches off `preserve-caught-error`, because it reports the coding style's error handling, which logs the caught error and throws a new error without a `cause`.

`sort-imports` orders import statements by their form first: side-effect imports, then namespace imports (`* as`), then imports of several names, then imports of one name. Within a form, it orders them by the first local name, with upper case before lower case. `--fix` sorts the names inside braces but does not move statements.

`local/banner-width` treats a comment as a banner when it fits on one line, starts at column 0, and has one of these shapes:

- A line of stars: `/*****…*/`
- A sub-section title: `/* TITLE ****…*/`
- The middle line of a section banner: `/* TITLE      */`

A title holds at least one upper-case letter, and otherwise only upper-case letters, digits, spaces and `-&'(),./:`. The fix adds or removes stars or spaces so that the banner ends at column 80. A title too long to fit is reported without a fix.

## Globals

Files in `js/` see browser globals, except files in `js/sim/`, which see only the globals that Node and browsers share. Files in `content/` also see only the shared globals. Files in `tools/`, `lint/` and `js-tests/`, and `eslint.config.js`, see Node globals. Files in `js-tests/browser/` and `tools/workbench/capture.js` see both, because the callbacks they pass to `evaluate` and `waitFor` run in the page. Files in `tools/workbench/page/` run in the browser, so they see browser globals and follow the same import rule as `js/`. Both lists are in `eslint.config.js`, which defines them without the `globals` package. ESLint adds the ECMAScript globals for the latest version.

## Files

| File | Holds |
|---|---|
| `plugin.js` | The `local` plugin, which registers each project rule |
| `rules/banner-width.js` | The `local/banner-width` rule |
| `tests/config.test.js` | `BROKEN` code that each rule must report, and `ALLOWED` code that the configuration must not report |
| `tests/rules.test.js` | `RuleTester` cases for each project rule, with the text that `--fix` writes |

A project rule is a class with a static `meta` and a static `create`. ESLint accepts only a plain object as a rule, so `plugin.js` wraps each class before it registers it.

## Adding a Rule

Follow the [gu-lint-rules skill](../.claude/skills/gu-lint-rules/SKILL.md). It sets where a rule belongs, how to measure it against the code, and how to prove that the check can fail.
