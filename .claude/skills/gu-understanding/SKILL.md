---
name: gu-understanding
description: Checks that a request is understood before work starts, asks clarifying questions with the AskUserQuestion tool when it is not, and uses quick static mockups to settle a concept before design or implementation. Use at the start of every request, and again when a task changes direction.
---

# Understanding the Request

Work built on a wrong reading of a request costs the time to build it and the time to undo it. Confirm you actually understand the request before the work starts.

## The Check

Read the request, the code it touches, and any related documentation. Then answer these questions:

1. What is the outcome being requested, and how will the requester judge that it is done?
2. Does the request have more than one reasonable reading?
3. Does a choice the requester would care about depend on a fact that the request, the code and the documents do not give?

When the answers are clear, state the assumption in one line and proceed. When they are not, ask before changing anything.

## Asking

- Ask with the AskUserQuestion tool, not in prose at the end of a reply.
- Ask only what changes the work. When a question has a conventional default, state the default instead of asking.
- Give 2 to 4 concrete options for each question, with the recommended option first.
- Group related questions in to a single call, up to 4 questions at a time.
- Repeat the process if the request changes or new information arises.
- Do not start the work while an answer is pending.

## Mockups

A request about how something looks or behaves, such as an interface panel, a layout, a model's shape or a player flow, is often clearer as a picture than as a description. Settle the concept with a quick static mockup before the design or the implementation starts.

1. Keep the mockup static and throwaway: one HTML file with inline CSS or SVG, or an ASCII sketch. Use no build step, no imports from `js/` and no game code.
2. Save the file in `local/scratchpad/`, which git ignores. Never put a mockup in the source tree.
3. To compare layouts, put an ASCII sketch in the `preview` field of each AskUserQuestion option, so the owner sees the options side by side.
4. Give the owner the path of the mockup, ask whether it matches the intent, and start the real work only after the owner confirms.

Skip the mockup when the change is small, when the request already fixes the result, or when existing code already shows the pattern to follow.
