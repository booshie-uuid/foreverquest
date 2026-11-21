---
name: gu-lint-rules
description: Turns a written rule into a lint rule or a guard test when a machine can check it exactly, and removes the prose that the check replaces. Use when the owner corrects how code is written, when a rule joins the coding style or js-tests/README.md, or to sweep the memories and the rule documents for rules that a machine could enforce.
argument-hint: "[the rule in words | sweep]  (default: the rules added or corrected in this session)"
---

# Lint Rules

Move each rule to the cheapest place that enforces it reliably. A check that runs on every change costs no context and cannot be forgotten. Prose costs context in every session and depends on the reader. A rule therefore becomes a check when a machine can check it exactly, and stays as prose only when it needs judgement.

## Scope

The argument sets the scope: `$ARGUMENTS`

- No argument: the rules that this session added, and the corrections that the owner made in this session.
- A rule in words: that rule.
- `sweep`: every written rule. Read the feedback memories in the memory directory, `.claude/rules/*.md`, and the Conventions, Rules and Lessons sections of `js-tests/README.md`.

## Where a Rule Belongs

| The rule is about | A machine can check it exactly | The rule goes to |
|---|---|---|
| How `.js` code is written: syntax, names, imports, layout | Yes | The lint: `eslint.config.js` |
| How files or data fit together, or what the HTML and CSS hold | Yes | A guard test in `js-tests/tests/guards/` |
| How code is designed, how a test is designed, or how text reads | No | Prose: `.claude/rules/coding-style.md`, `js-tests/README.md` or a skill |
| How the owner wants the work done: commits, reports, plans, questions | Not applicable | A memory |

A rule can split. The lint checks the width of a banner, and the coding style still describes the blank lines around it. Enforce the exact part and keep the prose for the rest.

## The Exactness Test

A rule is exact when both of these hold:

1. The text of the code alone shows every breach. The check needs no knowledge of intent.
2. The check reports no correct code. Run it over the whole repository and read every report. Each report must be a real breach.

One false report in the repository fails the test. Do not narrow the check until the reports stop if the narrow check no longer says what the prose says. A check that needs a switch-off comment in more than a few places is not exact, because each comment teaches the next writer to add another.

## Procedure

1. State the rule in one sentence, and find the text that holds it now.
2. Confirm that nothing enforces it yet. The Rules table in `lint/README.md` lists the lint rules, and the Guards section of `js-tests/README.md` lists the guards. "Examined and Left as Prose" below lists the rules that already failed the exactness test.
3. Choose the place from the table above.
4. For the lint, use the first of these that expresses the rule:
   1. A rule that ESLint provides.
   2. A rule that `@stylistic` provides.
   3. A `no-restricted-syntax` selector, with a message that says what to write instead.
   4. A project rule: a class with a static `meta` and a static `create` in `lint/rules/`, registered in `lint/plugin.js`.

   Do not add an npm package for a rule. Every package widens the supply chain, so a new package is the owner's decision.
5. Measure before enforcing. Switch the rule on, run `npx eslint .`, and read every report. Apply the exactness test. If the rule fails, switch it off, record it under "Examined and Left as Prose", and leave the prose where it is.
6. Prove that the check can fail:
   - For the lint, add a breaking case to `BROKEN` in `lint/tests/config.test.js`, and a case to `ALLOWED` for anything the rule must leave alone. A project rule also gets valid and invalid cases in `lint/tests/rules.test.js`, with the text that `--fix` writes.
   - For a guard, follow the Rules in `js-tests/README.md`. Break the file that the guard reads, confirm that the guard fails, and restore the file.
7. Correct the existing breaches. Run `npx eslint . --fix`, then correct the rest by hand. Run `npm run lint`, the unit suite and the browser specs for the files that changed. A correction that changes more than layout, such as a rename, follows "When Changing Code" in `AGENTS.md`.
8. Remove the prose that the check replaces:
   - Delete the sentence from the coding style or the README. Keep a reason that a reader still needs.
   - Add the rule to the Rules table in `lint/README.md`, or the guard to the Guards section of `js-tests/README.md`.
   - When the rule came from a memory and the check covers all of it, delete the memory file and its line in `MEMORY.md`. When the check covers part of it, cut the memory down to the part that still needs a reader.
9. Report in a few lines: each rule, where it is enforced now, how many breaches were corrected, which prose was removed, and each rule that stays as prose with the reason.

## Examined and Left as Prose

These rules failed the exactness test. Do not try them again unless the code has changed in a way that removes the reason.

| Rule | Why no check enforces it |
|---|---|
| Production code names a column by its `Columns` constant | A string that equals a column header is usually a label on the screen. All 31 reports in `js/` were labels |
| A blank line before every `return` | The coding style keeps a value and its check together, and 121 correct lines broke the rule |
| A fixed indent, and a maximum line length | ESLint's `indent` rule reported 9,195 lines, because it does not allow an Allman literal as an argument. The coding style sets no line length |
| Buttons and headings that a view model builds are in Title Case | The label is a string in `js/`, and nothing in the code marks which strings are labels. The `ui-labels` guard checks the labels written in the pages |
| Loose functions are imported as a namespace, in `js-tests/` | 65 test files import helper functions by name. The rule applies to the other folders. The owner deferred converting the tests to the next test review |
