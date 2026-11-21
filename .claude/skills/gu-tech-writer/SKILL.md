---
name: gu-tech-writer
description: Writing style, structure and formatting rules for technical documentation in Markdown, with Mermaid diagram references. Use when writing or editing any Markdown document (docs, READMEs, plans, reports, how-tos, notes) and before drawing a Mermaid diagram.
---

# Griffith University Technical Writing Skill

Write for a human audience that may be unfamiliar with the underlying technical details. Use only Markdown and Mermaid, unless another format is strictly necessary.

## Voice

- Use Australian English: organise, analyse, colour, behaviour, centre, licence (noun) and license (verb), program (software).
- Use active voice, so the actor is always clear: "The server rejects invalid tokens", not "Invalid tokens are rejected".
- Write in the third person with named actors, such as "the platform", "the application logic", "editors" or "administrators". Never use first-person pronouns (I, we, our), and avoid "you" wherever possible. Use imperative verbs for instructions (Run, Configure, Verify).
- Write in the present tense, with one main idea per sentence.
- Be concise. Include only the detail the reader needs, and cut waste words such as "in order to", "please note that" and "basically".
- Use one term for each concept or component throughout the document.
- Use literal words, not metaphors or idioms.
- Explain things in the order the reader meets them, such as the order in which a request passes through a system.
- Say why a thing is built the way it is when the reason is known. Never invent a reason.
- Verify every claim against the code, configuration or vendor documentation before writing it.

### Patterns to Avoid

These patterns mark text as machine-written. Write like a professional technical writer instead: concise and clear, in a human voice.

- "This matters", "why X matters" and "matters because". State the reason itself.
- Two- and three-word connectors such as "especially valuable", "builds trust", "helps to understand" and "taken together", unless they add meaning.
- Flourishes such as "load-bearing", "the real story" and "earns its keep".
- Formulaic pivots and signposts, such as "This isn't a technical problem. It's a management problem.", "It is important to note that", "The key takeaway is" and "In summary". Integrate the point into the text instead.
- Groups of three made by padding two points, and runs of sentences that share one length and rhythm.
- Strings of short, clipped sentences joined by "So".
- Bold lead-in phrases at the start of paragraphs or list items.

## Structure

- Headings name their topic, in Title Case. Avoid rhetorical headings such as "The Short Version" or "Why It Is Shaped This Way".
- Use prose for explanations. Use a list for parallel items, not to break an explanation into fragments.
- Number the steps of a procedure.
- Use a table only for data that is a table, such as routes, commands or settings. Keep cells short, with no paragraphs in them.
- Link to other files in the repository with relative paths, and give every code block a language.

## Example

This paragraph shows the target voice:

> The dashboard uses a proxy-based authentication model. The application logic does not handle authentication. The Azure Static Web Apps platform authenticates users with Entra ID. Maintainers specify the identity provider in the staticwebapp.config.json file. The platform automatically sends unauthenticated users to Entra ID before the request goes to the application logic.

## Diagrams

Use Mermaid diagrams for processes, structures and relationships that text alone cannot show clearly.

- Introduce every diagram in the text and explain what it shows. A diagram never stands alone.
- Keep each diagram to one concept or process. Split a complex flow into several smaller diagrams.
- Use labels that match the terms in the text. A node label is a name and at most one qualifier; the explanation belongs in the prose.
- Define diagrams in Mermaid text, not as images, so version control tracks their changes.

### Mermaid Diagram References

Before creating any Mermaid diagram, read `references/mermaid-style-guide.md`. Then open the reference for the diagram type, which holds an example, tips and a template.

| Use Case                                     | Diagram Type     | Template File                               |
| -------------------------------------------- | ---------------- | ------------------------------------------- |
| Process steps / decision logic               | Flowchart        | `references/diagrams/flowchart.md`          |
| Service interactions / API calls / messaging | Sequence         | `references/diagrams/sequence.md`           |
| Data model / schema                          | ER diagram       | `references/diagrams/er.md`                 |
| State machine / lifecycle                    | State            | `references/diagrams/state.md`              |
| System architecture (zoom levels)            | C4               | `references/diagrams/c4.md`                 |
| Chronological events / history               | Timeline         | `references/diagrams/timeline.md`           |
| Class hierarchy / type relationships         | Class            | `references/diagrams/class.md`              |
| Component layout / spatial arrangement       | Block            | `references/diagrams/block.md`              |
| Cloud infrastructure / service topology      | Architecture     | `references/diagrams/architecture.md`       |
| Binary protocol / data format                | Packet           | `references/diagrams/packet.md`             |
| Multi-diagram composition patterns           | Complex Examples | `references/diagrams/complex-examples.md`   |

Pick the most specific type, not a flowchart by default. A timeline shows chronological events better than a flowchart, and a sequence diagram shows service interactions better.

## Before Finishing

Reread the finished text and fix each of these:

1. A first-person pronoun, or a "you" that a named role or an imperative could replace.
2. A US spelling, such as -ize, -yze, color, behavior or center.
3. A passive sentence that hides the actor.
4. A phrase or pattern from "Patterns to Avoid".
5. A waste word, or a sentence that adds nothing.
6. A heading that does not name its topic.
7. A claim that has not been verified against the code or documentation.
8. A diagram without `accTitle` and `accDescr` (or the italic description for types that do not support them), or one that fails the Quality Checklist in the style guide. When mermaid-cli (`mmdc`) is available, render each diagram to confirm that it parses.
