---
name: feq-issue-writer
description: Writing rules for ForeverQuest's GitHub issues and issue comments. Use before creating, editing or commenting on an issue, before filing an idea or a bug, and when drafting issues for a mockup.
---

# ForeverQuest Issue Writer

An issue states one piece of work, one bug, one idea or one question, as briefly as the reader can act on it.

## Voice

- Use Australian English: organise, colour, behaviour, centre, licence (noun) and license (verb), program (software).
- Use active voice with the real actor as the subject: "The bake rejects the dungeon", not "The dungeon is rejected".
- Name the actor: "the player", "the editor", "the bake", "the creator". Use no first person and no "you".
- Write in the present tense, with one main idea per sentence. Use "can" for what someone is able to do.
- Use one term for each concept, and literal words, not metaphors or idioms.
- State facts and decisions. Leave out how the issue came about.
- Refer only to sources a reader can open from GitHub: another issue, a commit, or a file in the repository by relative link. Never cite a conversation, a review that is not in the repository, or anything in `local/`.
- Give the reason in one sentence when it is not obvious. The reason belongs in an issue, unlike a code comment.
- Verify every claim about the code against the code before writing it.

### Sound Like a Person

Concise does not mean compressed. Write each sentence as a developer would say it to a colleague, then read it aloud, and rewrite any sentence that would sound odd spoken.

- When a person does the action, make the person the subject. Do not give a person's action to a thing: "The creator can mark areas", not "A zone marks areas".
- Keep plain word order. Avoid a clause that ends on a stranded preposition, such as "the areas that the fog stays out of"; write "the areas kept free of fog".
- Keep the small words that make a sentence flow: articles, "can", "so that", "for example".
- Give the general case first, then at most one or two examples with "such as". Leave out scene-setting detail and vivid particulars.
- Put one outcome in a sentence. Split a sentence that joins two results with "and".
- Prefer the common word to the precise but rare one.

### Waffle to Cut

These phrases add length and no meaning. Cut them, or replace them with the fact they stand in for.

| Cut | Write instead |
|---|---|
| "This issue aims to", "The goal of this issue is" | The goal itself |
| "It would be great if", "Ideally", "We should consider" | The change, stated plainly |
| "Currently," at the start of a sentence | The present tense already says it |
| "comprehensive", "robust", "seamless", "powerful", "various", "a range of" | The specific thing, or nothing |
| "ensure", "leverage", "utilise", "facilitate" | "make sure" only when a check follows; otherwise the verb that names the action |
| "might potentially", "could possibly", "should hopefully" | One hedge, or none |
| A closing summary, a restated title, "Let me know if…" | Nothing |
| Emoji, bold lead-ins, exclamation marks | Nothing |
| "This matters because", "The key takeaway is", "It is important to note that" | The reason or the point itself |
| Flourishes such as "load-bearing" or "earns its keep" | The literal claim |
| A list of three padded out from two, or a run of short sentences joined by "So" | The real items, in sentences of varied length |
| "in order to", "please note that", "basically" | Nothing |

## Titles

- At most 60 characters, no full stop, no prefix such as "[Feature]" or "Bug:". The label carries the kind.
- An epic's title names a thing, so it takes Title Case: capitalise every word except articles, conjunctions and short prepositions (a, an, the, and, or, for, of, to, in, on, at, by) after the first word, and both parts of a hyphenated word. Every other kind takes sentence case.
- Each kind takes its own form:

| Kind | Form | Example |
|---|---|---|
| epic | A noun phrase naming the capability, in Title Case | Dungeon Generator |
| feature | An imperative verb and its object | Add protected fog areas to the bake |
| chore | An imperative verb and its object | Lazy-load the prefab catalogue |
| bug | The symptom as seen | Select outline reads one cube too large |
| idea | A short noun phrase or imperative | Stained glass that colours its light |
| decision | The question, with a question mark | Can the player jump? |

## Bodies

Use only the sections listed for the kind, in this order, as `###` headings. Leave out a section that would be empty. Keep a feature, chore or epic body under 150 words and an idea under 60.

### Epic

- **Goal**: two or three sentences on what the player, the builder or the creator gains.
- **Done when**: the sign-off, as one sentence the creator can check, such as "A walk through the generated dungeon reaches every set piece".
- **Out of scope**: only when a reader would assume otherwise.

The sub-issues list the parts. Do not repeat them in the body.

### Feature and Chore

- **Goal**: what changes, in one or two sentences, and why when it is not obvious.
- **Done when**: a checklist of observable results the creator can try or a test can prove. Write each as a fact about the finished work: "- [ ] A lever placed in the editor wakes a linked construct".
- **Notes**: constraints, related docs as relative links, and the creator's rulings that apply. Leave out implementation plans; they go in a comment when work starts.

### Bug

- **What happens**: the symptom, with the zone, the view or the steps that show it.
- **Expected**: what should happen instead.
- **Where**: a file and line when known, as `js/editor/select-tool.js:120`.

### Idea

One to three sentences that state the idea. An idea has no Done when until it is accepted into the backlog.

### Decision

- **Question**: the question and why it blocks work.
- **Options**: each option with its consequence in one line.
- **Recommendation**: one option and the reason.
- **Needed by**: the issue that waits on it.

When the creator decides, add a comment that states the ruling in one sentence, then close the issue.

## Labels and Links

- Give each issue one kind label: `epic`, `feature`, `chore`, `bug`, `idea` or `decision`. The area, status and size are project fields, not labels.
- Make a part of an epic its sub-issue, rather than listing it in a body.
- Refer to another issue by number, as `#12`, never by copying its text.
- A commit that finishes an issue ends its message with "Closes #n".

## Comments

Comment only when something changes: a question for the creator, a design note when work starts, a decision, or a hand-over for review. A comment never narrates ("Now working on…") or restates the issue.

- A design note gives the approach in a few bullets and the choices the creator may want to change.
- A hand-over for review says what to try, where, and what to judge.

## Creating Issues

Write each body to a file in the scratchpad and pass it with `--body-file`, so the shell never rewrites quotes, backticks or newlines:

```sh
"/c/Program Files/GitHub CLI/gh.exe" issue create --repo booshie-uuid/foreverquest --title "Add fog exclusion areas for height fog" --label feature --body-file "<scratchpad>/issue.md"
```

## Before Finishing

Reread each title and body, and fix each of these:

1. A title over 60 characters, with a prefix, or in the wrong form for its kind.
2. A section the kind does not use, or an empty one.
3. A phrase from Waffle to Cut.
4. A Done when item that the creator cannot observe or a test cannot prove.
5. A sub-issue's work also listed in its epic's body.
6. A first-person pronoun, a "you", a US spelling or a passive sentence that hides the actor.
7. A claim not checked against the code.
8. A source that cannot be opened from GitHub, such as a conversation, a review outside the repository or a file in `local/`.
