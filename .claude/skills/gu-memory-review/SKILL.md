---
name: gu-memory-review
description: Reviews the project's memories and deletes, shortens or merges the ones that no longer change how the work is done. Use when asked to clean up, prune or review memories. When MEMORY.md lists more than 40 memories, say so in one line at the end of a task; do not run this skill unasked.
argument-hint: "[report]  (default: review and apply; `report` lists the proposed changes without making them)"
---

# Memory Review

`MEMORY.md` loads into every session, and a memory file loads whenever a task recalls it. Each memory therefore costs context for as long as it exists. Keep a memory only while it changes what a future session does and nothing else says the same thing.

## Scope

The scope is this project's memory directory, which the session's instructions name: every memory file and the index, `MEMORY.md`.

The argument sets the mode: `$ARGUMENTS`

- No argument: review every memory and apply the changes.
- `report`: review every memory and report the proposed changes. Change nothing.

## The Test

A memory stays only when all 4 of these hold:

1. It is applicable. A future session would act differently because of it.
2. It is durable. It applies beyond the task that produced it.
3. Nothing else records it. The code, the documents, `AGENTS.md`, the skills, the lint and the tests do not already say it or enforce it.
4. It is still true. The files, functions and settings it names exist, and no later decision replaced it.

## Verdicts

| Verdict | When | Examples |
|---|---|---|
| Delete | The memory fails the test as a whole | A record of a finished plan or a closed review. A description of how a feature is built, which the code and `docs/` now show. A rule that a lint rule or a guard now enforces. A parked problem that the owner closed |
| Shorten | Part of the memory passes the test | A feature memory that holds one decision the owner made and the repository does not record. Keep the decision and its reason, and cut the history, the status, the dates and the commit ids |
| Merge | Several short memories cover one subject | Three memories on how the owner wants interface text written |
| Move | The memory is a rule about code or tests | Run the `gu-lint-rules` skill on it, or add it to the document that holds such rules, then delete the memory |
| Keep | The memory passes the test as it is | The owner's feedback on how to work, with its reason. A pointer to a resource outside the repository. A fact about this machine that the owner would otherwise repeat |

Feedback from the owner has a stricter rule. Never delete a feedback memory because it is old or has not come up lately. Delete it only when a check now enforces it, when a named document or skill now states it, or when the owner reversed it. When in doubt, keep the memory and list it in the report as a question.

## Procedure

1. Copy the memory directory to a folder named `memory-backup` beside it, and replace any backup already there. The review deletes files, and no version control holds them.
2. Read `MEMORY.md` and every memory file.
3. Apply the test to each memory and choose a verdict. Verify each claim that the verdict rests on:
   - Before deleting a memory because the repository records it, find the place: the function, the document section, the lint rule or the test.
   - Before keeping a memory, confirm that what it names still exists. Correct a path or a name that has changed.
4. Apply the verdicts:
   - Delete the file and its line in `MEMORY.md`.
   - Rewrite a shortened or merged memory as one fact with its reason and how to apply it. Update its `description`.
   - Remove or repoint each `[[link]]` to a deleted memory.
   - When the session is not permitted to delete a file, leave the file, remove its line from `MEMORY.md`, and list it in the report for the owner to delete.
5. Rewrite `MEMORY.md`: one line for each memory, short enough to read at a glance, with no line for a deleted memory and no memory without a line.
6. Report in a few lines: how many memories were kept, shortened, merged, moved and deleted, each deleted memory with its reason in a few words, each question for the owner, and the path of the backup.

In `report` mode, do steps 2 and 3 only, then report the verdicts as proposals.
