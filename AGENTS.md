# Working Guidelines

## Scope

- Be concise and efficient in your communications, including your internal dialogue.
- Every changed line traces to the request. Do not reformat or refactor adjacent code unless it is required by the request.
- Mention unrelated problems (dead code, broken links) instead of fixing them. Remove only what your own change made unused.

## When Changing Code

1. Use the `gu-understanding` skill to ensure you understand the request.
2. Follow `.claude/rules/coding-style.md`. It should load by itself for `.js` files.
3. While working, run the unit suite and the browser specs for the capability you changed 
   (`node js-tests/browser/run.js --covers <tag>`). See "When to run what" in `js-tests/README.md`.
4. If a bug gets past the test suites, check whether a rule or a lesson in `js-tests/README.md` already covers that kind of gap.
   Add a lesson only when none does and the practice would catch other bugs too. A one-off bug gets a test, not a lesson.
5. When you are satisfied your code changes are working as intended, run `npm run lint` and resolve any issues.
6. Update the docs, READMEs and the capability map in `js-tests/README.md` that the change affects. Search them for the names, 
   routes and files you changed.
7. Run the `gu-comment-review` skill on your diff.
8. Run the full browser suite.

## When a Rule Is Added or Corrected

Run the `gu-lint-rules` skill when the creator corrects how code is written, or when a rule joins
`.claude/rules/coding-style.md` or `js-tests/README.md`. The skill turns a rule that a machine can
check exactly into a lint rule or a guard test, and removes the prose that the check replaces.

## When Writing Documentation

Load the `gu-tech-writer` skill before writing.

## Project/Scope/Backlog Management

When the creator raises a new idea or requests a new feature, use the `gu-understanding` skill to ensure you fully understand the request, 
and then use the `feq-issue-writer` skill to add issues to the GitHub project board.

## Local Scratchpad

In addition to your own internal scratchpad, you have access to `local/scratchpad` to share ideas with the requestor.

If you have something you need to share with the requestor for feedback, you should always use the local scratchpad.

Once you have got the required feedback on items in the local scratchpad, you should clean up the scratchpad so that
it doesn't become cluttered.
