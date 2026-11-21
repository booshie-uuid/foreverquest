---
name: gu-comment-review
description: Reviews code comments against the project's comment rules and deletes or shortens the ones that break them. Use as the second-last step of every code change (on the diff), or to clean up comments in a file, a folder or the whole project.
argument-hint: "[path | all]  (default: the uncommitted diff)"
---

# Comment Review

Review the comments in scope against the rules below. Delete or shorten each comment that breaks them. Change nothing else.

## Scope

The argument sets the scope: `$ARGUMENTS`

- **No argument:** the comment lines the uncommitted work adds or changes. Take them from `git diff HEAD -- '*.js'`, plus every comment in new files from `git ls-files --others --exclude-standard -- '*.js'`. Comments the diff does not touch are out of scope.
- **A file or folder path:** every comment in the `.js` files under that path.
- **`all`:** every comment in the project's `.js` files. Work one top-level folder at a time (`js/`, `api/src/`, `js-tests/`). When subagents are available, give each folder to its own subagent with this skill's rules and procedure.

Never review `libs/` or `node_modules/`: that code is third-party.

## Procedure

1. List the comments in scope. A comment block of several consecutive lines counts as one comment.
2. For each comment, apply the test in the rules: would a reader be left with a question the code cannot answer if the comment were removed?
   - **No:** delete the comment.
   - **Yes, and the comment holds only that fact:** keep it.
   - **Yes, but the comment also explains design or narrates the code:** shorten it to the fact.
3. Leave these alone:
   - Section and sub-section banners, such as `/***…***/` and `/* NAME ***…*/`.
   - Tool directives, such as `/* global … */` and `// eslint-…`.
4. Change only comment text. Do not rename, move or reformat code. When a deleted comment shows that a name is unclear, report it instead of renaming.
5. After deleting a comment, remove a blank line it leaves doubled.
6. Report the result in a few lines: how many comments were reviewed, deleted, shortened and kept, and any names worth renaming. In `all` or path mode, give the counts per folder.

## Rules

A comment exists to surface a fact about the code that a reader cannot recover by reading the code itself: a quirk, an edge case, an API limitation, an invariant, a pointer to where the algorithm comes from. It is **not** a place to record the developer's reasoning about choices or architecture.

The test: if you removed the comment, would a future reader be left with a question the code cannot answer on its own? If **yes**, keep it. If **no**, delete it.

Additionally, a comment must not contain point-in-time reasoning or references (such as references to working documents or issue numbers which can become outdated and confuse future readers).

### Worthwhile Comments

Things the code genuinely cannot express:

- **Non-obvious edge cases:** "Empty list short-circuits at the call site, so this branch only fires for length >= 1."
- **API quirks / 3rd-party gotchas:** "jsdom returns null without the optional `canvas` npm package."
- **Hidden invariants enforced upstream:** "Caller guarantees `cx` is in-bounds — no defensive check."
- **References for complex math or algorithms:** `// Rodrigues rotation formula — en.wikipedia.org/wiki/Rodrigues%27_rotation_formula` so a reader can look it up.
- **Workarounds for upstream bugs:** "GLTFLoader emits two `load` events on cached responses — guard with `if(this.loaded) return`."
- **Load-order / race-condition notes:** "Must run after `world.addEntity` so the entity's components are attached."

### Worthless Comments — Includes "Design Reasoning"

Comments are NOT for explaining *why the code was written this way*. Those answers belong in the plan, design, or commit history. In particular:

- **Rationale narratives** ("We chose X over Y because Z"). Decision-register territory.
- **Module / class headers** that explain what the module does. The class name and method signatures already say what; a multi-paragraph preamble is duplication.
- **Restating the function signature** ("Returns the value of X").
- **Narrating obvious code** ("Loops over each item").
- **Lead-in sentences** that summarise the very next line.
- **Lengthy exposition** of any kind.
- **Pointers to "the recent X change"** which rot fast and are already covered by commit history.
- **Justifying field defaults** ("This is null because we set it later in `start()`"). The set site is the right place if anything.

```javascript
// Avoid: explains the developer's rationale, not the code
// We chose a Map here instead of a plain object so we can use entity
// constructors as keys without coercion to strings.
this.components = new Map();

// Prefer: drop the comment. The code is self-evident.
this.components = new Map();


// Avoid: module-header narrative, restates what the class name says
/*
 * Asset manager. Loads the manifest, preloads core-tier assets at boot,
 * and resolves entity kinds to scenes on demand. ...
 */
class AssetManager { ... }

// Prefer: drop the comment block; the class name + method signatures speak.
class AssetManager { ... }


// Good: surfaces a real quirk that the code can't reveal
// Blizzard returns an empty `cstr` for single-step achievements; the
// achievement-level `description` field is the human-readable label.
function getAchievementHeader(achievementId) { ... }


// Good: pointer to algorithm reference
// Rodrigues rotation formula — rotates a vector around an axis by an angle.
function rotateAround(vector, axis, angle) { ... }
```

If you find yourself wanting to write a paragraph: stop. Either it belongs in the plan / design document, or the code itself needs to be rewritten so the comment isn't needed.

## Voice

Write comment text by the Voice rules and Patterns to Avoid in the `gu-tech-writer` skill (`.claude/skills/gu-tech-writer/SKILL.md`). One rule there does not apply: a comment never says why the code is built the way it is.
