---
paths:
  - "**/*.js"
---
# Coding Style

## Enforced by Lint

ESLint enforces the mechanical rules: Allman braces, `if(` with no space before the parenthesis, double quotes, semicolons, trailing commas, names without a `_` prefix, sorted imports, no `console` call outside `Log`, and banners that end at column 80. Run `npm run lint` after a change, and `npx eslint . --fix` to correct what ESLint can. `lint/README.md` lists every rule. The rules below need judgement, so no tool checks them.

## Classes and Modules

### Encapsulated Mutation

Only an object modifies its own internal state, so every change goes through one method that can validate it and emit a change event. External logic calls methods (e.g. `store.save(entry)`) rather than modifying properties directly (`store.entries.set(key, entry)`).

- Use ES6 classes for stateful entities and complex logical grouping.
- Break complex tasks into internal methods, so the public API stays clean without overloaded functions.

### State Change Notification

A class emits a change when other parts may need to react to it (e.g. to update the UI). Other parts subscribe to the classes they care about; there is no global event bus. View models use Knockout observables. Other classes keep their own listeners:

```javascript
onChange(listener)
{
    this.listeners.push(listener);
}

emitChange()
{
    for(const listener of this.listeners) { listener(this); }
}
```

### Stateless Utilities (Modules)

A module that exports loose functions, rather than classes, holds only "pure" stateless helpers, to avoid unnecessary Singletons. Import it with `import * as Namespace` only; named imports of its functions (e.g. `{ func }`) are prohibited.

```javascript
import * as Utils from "./utils.js";

Utils.format(data); // clear provenance
```

### Class Modules

A module that exports classes is imported by class name: the class is the namespace, so the call
already shows where it comes from.

```javascript
import { Meta } from "./meta.js";
import { RecordSet } from "./records.js";

RecordSet.build(stored, Meta.read(meta)); // clear provenance
```

---

## Naming Conventions

- Variables and functions: `camelCase` with descriptive names.
- Booleans: prefer `is`, `has`, `should`, or `can` prefixes.
- Classes: `PascalCase`.
- Global constants: `UPPER_SNAKE_CASE`.
- Class fields, methods, static fields and module helpers: plain `camelCase`. `this.` already shows scope; where real privacy matters, use `#privateField`.

Short names are acceptable when their meaning is clear from the surrounding context (e.g. `i` for a loop index). Otherwise, prefer descriptive names. Avoid ambiguous abbreviations (like `vm` for "view model") that may have multiple interpretations.

---

## Readability & Formatting

### Paragraphs by Role

Group related statements into logical paragraphs separated by a blank line. Paragraph breaks are set by role, not by syntax: a run of `const` statements is not one paragraph if the variables play different roles. These role changes always take a blank line:

- Reading inputs / context  →  initialising mutable state
- Initialising defaults  →  branching/computing
- Computation  →  applying to outputs (writes to `this.*`, return value, side effects)
- One self-contained "phase" of the function  →  the next phase

A guard clause (`if(...) { return; }`) at the top of a function is its own phase. One exception: a value and the check that verifies it (`const x = compute(); if(!valid(x)) { return null; }`) stay together as one phase, with a blank line before and after the pair.

```javascript
async add(principal, field, amount, extra)
{
    const row = await this.table.get(principal.userId, UserActivity.ROW_KEY);
    const current = row ? row[field] : undefined;
    const isReadable = current === undefined || UserActivity.isCount(current);

    if(!isReadable) { this.log.warn("Restarted an unreadable " + field + " count: " + principal.userId); }

    await this.table.merge(
    {
        partitionKey: principal.userId,
        rowKey: UserActivity.ROW_KEY,
        userDetails: principal.userDetails,
        [field]: (isReadable ? current ?? 0 : 0) + amount,
        ...extra,
    });
}
```

When in doubt, add the break.

### Line Density

- Avoid "clever" one-liners and shorthand that compresses complex logic into one line.
- A simple guard or trivial transformation may sit on one line only if it stays immediately scannable. Complex conditions or several statements take multiple lines.
- Use implicit arrow returns only for trivial, single-operation mappings. A function with a condition or several steps takes an explicit block.
- Favour vertical space over horizontal density. If a line needs horizontal scrolling to understand, it is too complex.

### Aligned Columns

Align columns (padding before `=`, `{`, etc.) only when three or more consecutive lines have the same shape, so the eye sees the pattern repeat. Do not pad heterogeneous lines into a column.

```javascript
// Good: same-shape lines
list()       { return [...this.entries.values()]; }
count()      { return this.entries.size; }
get(key)     { return this.entries.get(key) ?? null; }

// Avoid: different kinds of field padded to line up
this.table   = table;
this.log     = log;
this.pending = new Map();
```

---

## Comments

Write a comment only to surface a fact the code cannot show: a library, browser or API quirk, a non-obvious edge case, an invariant enforced elsewhere, or a reference for an algorithm. Never record design reasoning, describe what a module does, or narrate the next line. The `gu-comment-review` skill holds the full rules and reviews the comments in each change.

### Structural Comments

Comments should also be used to help break up large files and keep them easy to navigate.

- Section headers should be a three line banner padded to exactly 80 columns. There should be two blank lines above the banner and one blank line below it before the first declaration in the section.
- Sub-Section headers should be a single line banners padded to exactly 80 columns. There should be a single blank line above the banner.
- Header text should be capitalised and concise.

```javascript


/******************************************************************************/
/* SECTION                                                                    */
/******************************************************************************/

function firstThingInSection()

/* SUB-SECTION ****************************************************************/

function firstThingInSubSection()
```

---

## Error Handling and Logging

Handle errors where a failure can occur, and never swallow one silently. Use async/await with try/catch. Log the failure through `Log` (`js/log.js`), then throw or show a message the user can act on:

```javascript
async function loadUser(userId)
{
    try
    {
        return await UserApi.read(userId);
    }
    catch(error)
    {
        Log.error("Could not load the user", error);

        throw new Error("The user could not be loaded. Try again later.");
    }
}
```

- `Log.error` for unrecoverable failures, `Log.warn` for recoverable ones.

---

## Column Names

Production code names a data column by its constant in `js/columns.js` (`Columns.SOLUTION.HOSTING`), never as a string. Tests do the opposite and write the header as a literal, so a renamed column fails the test that depends on it. The lint reports a test that imports `js/columns.js`.
