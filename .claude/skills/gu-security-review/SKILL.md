---
name: gu-security-review
description: Audits a project for security issues and writes the findings to local/reports/YYYY-MM-DD-security-review.md, with a summary table and one structured block per issue. Use when asked for a security review, a security audit, or a check of pending changes for security issues.
argument-hint: "[diff | path]  (default: the whole project)"
---

# Security Review

Audit the code and configuration in scope, verify each finding, then write a report. The review changes no code and no configuration: the report is its only output.

## Scope

The argument sets the scope: `$ARGUMENTS`

- **No argument:** the whole project.
- **`diff`:** the uncommitted work only. Take it from `git diff HEAD` and `git ls-files --others --exclude-standard`. Read the code around each change far enough to see how its data arrives and where it goes.
- **A file or folder path:** the code under that path, plus the configuration that controls access to it.

Do not audit vendored or installed third-party code line by line (for example `node_modules/`, `vendor/`, minified libraries). Check its versions for published vulnerabilities instead.

## Ground Rules

- Read files and run local tools only. Do not send requests to a deployed site or to any live service. The one exception is the package manager's audit command, which sends the dependency list to its registry.
- Never copy a secret, key, token or connection string into the report. Give its file and line, and mask the value.
- Report an issue only when there is a path to it: name who can trigger it and how. A pattern that looks unsafe but cannot be reached goes under "Checked With No Issues", with the reason.
- When the project's instructions (`AGENTS.md`, `CLAUDE.md` or a security document) name extra checks, apply them too.

## Procedure

1. Identify the stack: languages, frameworks, hosting and deployment configuration, the authentication provider, data stores and dependency manifests.
2. Map the attack surface:
   - The entry points: routes, API handlers, functions, jobs, message consumers and command-line tools.
   - Where access is decided: hosting route rules, middleware and checks inside handlers.
   - Every place the application renders, stores or executes data that a user or an external system supplied.
   - Every file the application imports or exports.
3. Work through the checks below as they apply to this stack. Note what was checked, even when nothing is wrong. Skip a check that has nothing to apply to, and say so in the report.
4. Verify each candidate finding. Trace the data from its source to the unsafe use, and confirm that no earlier step blocks it. Mark the finding "Confirmed" when the path is traced end to end, or "Likely" when one step depends on behaviour that the code does not show, such as a platform default.
5. Rate each finding with the severity scale below.
6. Write the report, as set out in "Report". Load the `gu-tech-writer` skill first and follow its voice and writing rules.
7. Reply with the report's path and one line of counts per severity. If `local/` is not ignored by git (`git check-ignore local/reports`), say so in the reply.

## Checks

### Authentication and Access Control

- Every entry point that changes data or returns another user's data requires sign-in and checks the caller's role or ownership on the server. A rule in hosting configuration alone is one layer; check which methods and paths it does not cover.
- Roles and identity come from a trusted source (the identity provider or a server-side lookup), not from values the client can set.
- A user can read and change only their own records, unless their role allows more.
- State-changing requests that rely on cookies are protected against cross-site request forgery (SameSite cookies, tokens or an origin check).

### Exposed Files

- The server or static host serves only the files the application needs. Check for source maps, environment files, backups, notes, plans, reports, tests, local-development files and agent instructions that a visitor could request.

### Input Handling

- Every request body, query string, header and uploaded file is validated for type, length and count before use.
- Input never reaches a query, command, file path, template or key without escaping or parameterisation (SQL and NoSQL injection, command injection, path traversal, template injection).
- Error replies do not leak stack traces, connection strings or internal paths.
- Requests that do expensive or unbounded work have a limit.

### Output Rendering

- Data from users, the API or files reaches no HTML sink without encoding: `innerHTML`, framework bindings that render raw HTML, `insertAdjacentHTML`, `document.write`, and chart or tooltip formatters that return HTML.
- Links and URLs built from data cannot carry `javascript:` or other unsafe schemes, and redirects go only to allowed destinations.

### Imports and Exports

- Exported CSV or spreadsheet cells that start with `=`, `+`, `-` or `@` are neutralised (formula injection).
- Imported files are size-checked and validated before their contents are used.

### Secrets and Configuration

- No secrets in tracked files: search `git ls-files` output for keys, tokens, passwords and connection strings. Local settings files that hold secrets are git-ignored.
- Security headers are set: Content-Security-Policy, X-Content-Type-Options, frame-ancestors or X-Frame-Options, Referrer-Policy, and Strict-Transport-Security where the host does not add it.
- Debug modes, test endpoints and permissive CORS settings are off in production configuration.

### Dependencies

- Run the package manager's audit for each manifest that ships to production (for example `npm audit --omit=dev`).
- Compare the versions of vendored libraries against published advisories.

### Data Handling

- Logs record personal details only where needed, and never secrets or full request bodies with personal data.
- Browser storage (`localStorage`, `sessionStorage`, cookies) holds nothing that would harm the user if another person used the same browser.

## Severity

| Severity | Meaning |
| -------- | ------- |
| Critical | Any signed-in user, or a person who is not signed in, can read or change data beyond their role, with no special conditions. |
| High | A realistic attack reads or changes data beyond the user's role, or runs script in another user's browser. |
| Medium | The attack needs unusual conditions or has limited impact, or a missing control leaves a known attack class open. |
| Low | A hardening gap with little direct impact. |

## Report

Write the report to `local/reports/YYYY-MM-DD-security-review.md`, with today's date from `date +%F`. If that file exists, add `-2`, `-3` and so on before `.md`. Create the folders when they do not exist.

The reader may not know the code. Describe each impact as who can do what, not as an attack name alone. Number the findings `SEC-01`, `SEC-02` and so on, most severe first.

Use this structure:

````markdown
# Security Review YYYY-MM-DD

Scope: <whole project | uncommitted changes | path>. Commit: <git rev-parse --short HEAD>, <with | without> uncommitted changes.

<Two or three sentences: the overall position and the most urgent issue.>

## Summary

| ID | Severity | Issue | Location |
| -- | -------- | ----- | -------- |
| SEC-01 | High | <Short title> | `path/file.js:42` |

## Findings

### SEC-01: <Short Title>

| Severity | Confidence | Category | Location |
| -------- | ---------- | -------- | -------- |
| High | Confirmed | Authentication and Access Control | `path/file.js:42` |

#### Issue

<What is wrong, in two to four sentences.>

#### Impact

<Who can exploit it, what they need, and what they can then do.>

#### Evidence

<The few lines of code or configuration that show the issue, in a fenced block, with the path and line.>

#### Recommendation

<The change that fixes it. Name the file and the function.>

#### Verification

<How to confirm the fix, such as a test to add or a request that must now fail.>

## Checked With No Issues

| Area | What Was Checked |
| ---- | ---------------- |
| <Check heading> | <One line> |

## Not Covered

<What this review could not see, such as cloud portal settings, identity provider role assignments, network rules and the deployed site's live headers.>
````

When there are no findings, keep the Summary heading and write "No issues found." in place of the table.
