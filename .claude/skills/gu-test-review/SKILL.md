---
name: gu-test-review
description: Reviews automated tests for meaningful assertions, behaviour coverage, dead ends and repeats of known testing mistakes, using mutation checks to prove that tests can fail, and writes the findings to local/reports/YYYY-MM-DD-test-review.md. Use when asked for a test review, a test audit, or a check of whether the tests would catch a bug.
argument-hint: "[diff | path | all]  (default: diff)"
---

# Test Review

Review the tests in scope, verify each finding, then write a report. The review changes no test and no production code. The only exception is the temporary mutations of the mutation checks, which the review always restores.

## Scope

The argument sets the scope: `$ARGUMENTS`

- **No argument or `diff`:** the uncommitted work. Take it from `git diff HEAD` and `git ls-files --others --exclude-standard`. Review the tests that the work adds or changes, and check that the production code it changes has tests that would catch a mistake in it.
- **A file or folder path:** the tests under that path and the production code they test, or the production code under that path and its tests.
- **`all`:** the whole suite, one area at a time. Run mutation checks on a sample: the modules that change stored data, compute values that users see, check permissions or handle input.

## Ground Rules

- Before a mutation, copy the file. After the test run, restore the copy and confirm that the file matches it byte for byte. Never leave a mutation in place, even when a run fails or times out.
- After a mutation, run only the tests that own the mutated code, not the whole suite.
- Report a finding only with evidence: the test's name and line and, for a mutation, the change and the result.
- A review cannot decide whether a behaviour is right. When a test asserts what the code does today and nothing says why that behaviour is right, record a question for the owner, not a finding against the test.
- Apply the project's own test rules and lessons. Find them through the project instructions (`AGENTS.md`, `CLAUDE.md`), the test folder's README and `CONTRIBUTING`. Where a project rule conflicts with this skill, the project rule applies.

## Procedure

1. Learn the test setup: the runners, the commands that run a single test or file, how the runner selects files, any coverage tool, and the project's rules and lessons.
2. Map the behaviour in scope: entry points, branches, error paths, permission checks and user flows. For each behaviour, name the test that owns it, or record that none does.
3. Work through the checks below. Note what was checked, even when nothing is wrong.
4. Run the mutation checks. For each important guarded line, make two mutations, one at a time:
   - Remove the line's effect (delete the statement, return early, drop the condition).
   - Make the mistake a developer would plausibly make: an off-by-one, the wrong comparison, a swapped branch, the wrong field, a missing `await`, a default used in place of a value.

   Run the owning tests after each. A mutation that no test fails on is a finding.
5. Verify each candidate finding. Confirm a claim that a test never runs with the runner's own file list or a run that names the test. Confirm a claim that a test cannot fail with a mutation.
6. Rate each finding with the severity scale below.
7. Write the report, as set out in "Report". Load the `gu-tech-writer` skill first and follow its voice and writing rules.
8. Reply with the report's path, one line of counts per severity, and the number of proposed lessons. Confirm that every mutated file is back to its original content.

## Checks

### Meaningful Tests

- Each test asserts a result of the behaviour. A test that only calls the code, or checks only that nothing threw, proves little.
- An assertion checks the specific value when that value is known, not only that a value is truthy, has a length or has a type.
- The expected value does not come from the code under test. A test that computes its expectation with the same function always passes.
- The test enters through the entry point that production uses, with arguments that production can produce. Production code has no parameters or defaults that only tests use.
- The test's title names the consequence of a failure for a user or a data consumer, not the function it calls.
- The test data can tell the rule from its likely mistake. For example, two rows that differ only where the rule applies.
- A mock does not replace the code under test, and it behaves as the real dependency does.

### Coverage

- Every behaviour in the map has an owning test. Look first at error paths, empty inputs, boundaries, permission checks and concurrent actions.
- Each behaviour has one owner. The same cases tested at several levels slow the suite and drift apart.
- Line coverage shows that a line ran, not that a test checked its result. Use a coverage report to find untested code, never as proof that code is tested.

### Dead Ends

- Tests that never run: skipped or focused tests (`skip`, `only`, `todo`), files outside the runner's pattern, tests behind a condition that never holds where the suite runs.
- Tests that cannot fail:
  - assertions on constants, or conditions that are always true;
  - `catch` blocks that swallow assertion errors;
  - assertions inside callbacks that never run, or promises that the test does not await;
  - a test that returns before it asserts.
- Tests that skip themselves when their data is missing. A data-dependent test asserts its precondition and fails when it does not hold.
- Flows that stop at the failure. After an error, an empty result, a declined prompt or a cancel, the test uses the system again and checks that it recovered.

### Known Gaps

These kinds of gap let real bugs pass green suites. Check each one that applies to the code in scope.

- **Tidy fixtures.** The fixtures leave out shapes that real data has: a record in several groups, a blank optional field, an undeclared value, non-ASCII text, a month-end date, a malformed stored row.
- **One actor, one step.** A feature for several people or steps is tested with one: a merge against its own base, one import file, one tab, one export. Test two actors, sequences of two actions, and an action that changes nothing.
- **Values set in one event.** A helper sets a field's final value at once, so the tests never see the intermediate values that typing passes through.
- **Untested seams.** Each module is right on its own, but the next module refuses or misreads what one writes. Test what a module writes through the reader that consumes it.
- **Unguarded stored data.** Stored or published data breaks a rule that the application enforces only on edit. Validate the stored data itself.
- **Untested outcomes and interleavings.** A download fails, a dialog is cancelled, or an edit arrives while a build is still running. Stub the outcome, and hold an asynchronous step open so the test can act while it waits.
- **Shallow input tables.** A case table tries only the obvious inputs. Add values that the parser accepts in full but that are still wrong, a known flag with a wrong value, and two parts that contradict each other.
- **Disarmed by a fix.** A fix changes what a module reads or compares, and the older tests' inputs no longer reach the rule they guard. Mutation-check those tests again.
- **Environment differences.** The test environment behaves differently from production: a headless browser cancels native dialogs, a time zone or locale differs, an invisible character is stripped from a literal. Stub what differs, and assert invisible characters by code unit.

## Severity

| Severity | Meaning |
| -------- | ------- |
| High | A test that the suite relies on never runs or cannot fail, or a behaviour that changes stored data, checks permissions or computes values that users see has no test that catches a plausible mistake. |
| Medium | A plausible mistake survives the owning tests, or a known gap applies to an important behaviour. |
| Low | A weakness with limited consequence, such as a title that names the function, a loose assertion where the exact value is easy to state, or a behaviour with two owners. |

## Report

Write the report to `local/reports/YYYY-MM-DD-test-review.md`, with today's date from `date +%F`. If that file exists, add `-2`, `-3` and so on before `.md`. Create the folders when they do not exist.

The reader may not know the code. Describe each issue as the bug that could pass, not only as the rule that the test breaks. Number the findings `TEST-01`, `TEST-02` and so on, most severe first.

Propose a lesson only for a kind of gap that the project's rules and lessons do not cover, and that would catch other bugs too. A one-off weakness gets a recommendation, not a lesson. Most reviews propose none.

Use this structure:

````markdown
# Test Review YYYY-MM-DD

Scope: <uncommitted changes | path | whole suite>. Commit: <git rev-parse --short HEAD>, <with | without> uncommitted changes.

<Two or three sentences: the overall position and the most important gap.>

## Summary

| ID | Severity | Issue | Test or Code |
| -- | -------- | ----- | ------------ |
| TEST-01 | High | <Short title> | `path/file.test.js:42` |

## Findings

### TEST-01: <Short Title>

| Severity | Category | Test | Code Under Test |
| -------- | -------- | ---- | --------------- |
| High | Dead Ends | `path/file.test.js:42` | `path/file.js:17` |

#### Issue

<What is wrong, in two to four sentences, and the bug that could pass because of it.>

#### Evidence

<The few lines that show the issue, in a fenced block with the path and line. For a mutation, the change made and the test result.>

#### Recommendation

<The test to add or change, with the data it needs.>

#### Verification

<How to confirm the fix, such as the mutation that must now fail.>

## Mutation Results

| Code | Mutation | Tests Run | Result |
| ---- | -------- | --------- | ------ |
| `path/file.js:17` | `>=` changed to `>` | `file.test.js` | Failed (caught) |

## Questions for the Owner

<Each test that asserts current behaviour with no stated reason, and the question it raises. "None." when there are none.>

## Proposed Lessons

<Each proposed lesson: its name, what went wrong and what to do. "None." when there are none.>

## Checked With No Issues

| Area | What Was Checked |
| ---- | ---------------- |
| <Check heading> | <One line> |

## Not Covered

<What this review did not check, such as code outside the scope, mutation checks it sampled out, and suites it could not run.>
````

When there are no findings, keep the Summary heading and write "No issues found." in place of the table.
