---
name: code-review
description: Reviews a diff or a set of files for correctness bugs first and simplification second. Every finding is verified against the code before it is reported, ranked by severity, and given with file:line, a concrete failure scenario, and a suggested fix. Does not rewrite code unless asked. Use when the user asks to review code, a pull request, a branch, a commit, uncommitted changes, or specific files, or asks whether a change is safe to merge.
license: MIT
---

# Code review

Find real defects, prove each one against the code, and report them in order of severity. This is a read-only task: do not `edit`, `write`, or `patch` anything unless the user asks you to apply fixes.

## Step 1: Establish what is under review

Work out the target from the request. If it is ambiguous, ask once with `ask`.

| Request | How to get it with `bash` |
|---|---|
| Uncommitted changes | `git status --short`, then `git diff HEAD` |
| A branch | `git merge-base HEAD <base>` then `git diff <merge-base>...HEAD` |
| A commit | `git show <sha>` |
| Named files or a folder | `read` the files; no diff |

Use only git commands that do not change the repository. Do not check out, stash, reset, or commit.

If the diff is large, start with `git diff --stat` and review file by file. Skip lock files, generated code, and vendored code, and say that you skipped them.

## Step 2: Understand the change before judging it

1. State in one or two sentences what the change is meant to do. Take this from the commit messages, the request, or the code itself.
2. `read` each changed file in full, not only the changed lines. A diff hunk hides the surrounding conditions.
3. For every function, type, or constant whose behaviour changed, find its callers and its other users (`grep -rn` or `git grep -n` through `bash`) and read them.
4. Read the project's contributor notes if present (`README`, `CONTRIBUTING`, agent or style instruction files) so your findings follow the project's own rules.

## Step 3: Look for correctness bugs

Go through the changed code with these questions. Each is a place to look, not a finding by itself.

- Inputs: empty, null or undefined, zero, negative, very large, duplicate, wrongly typed, containing separators or non-ASCII text.
- Boundaries: off-by-one, inclusive versus exclusive ranges, first and last element, empty collection.
- Control flow: a branch that cannot be reached, a missing `else`, an early return that skips cleanup, a fall-through, an inverted condition.
- Errors: an exception swallowed or logged and ignored, a promise not awaited, a failure path that leaves partial state, a resource not released.
- Concurrency and ordering: shared state changed across an await, a check followed later by a use, callbacks that fire after disposal, reliance on iteration order.
- Contracts: a changed signature, return shape, default, or error type that an existing caller still relies on; a renamed field still read under the old name.
- Data: an unsafe cast, a lossy conversion, time zone or unit mix-ups, mutation of an argument the caller keeps using.
- Security: unvalidated input reaching a shell, a query, a file path, or HTML; secrets in logs; a permission check that was removed or bypassed.
- Removals: deleted code whose behaviour something still depends on.

## Step 4: Verify every candidate

A candidate becomes a finding only after you have done all of these:

1. Read the exact lines again and confirm the code says what you think it says.
2. Trace one specific input or sequence of events from an entry point to the failure. Name the values.
3. Check that nothing upstream prevents it: a guard in the caller, a type that excludes the value, validation at the boundary, a test that already covers the case.
4. If it is cheap and has no side effects, confirm by running something: the type checker, the linter, or a one-line reproduction. Do not run commands that write to the project, hit the network, or change data. Do not add or run tests unless the user asked for that.

Discard a candidate you cannot trace to a concrete failure. If it still looks risky but you could not prove it, list it under Questions, not under Findings.

For a review of many files you may split the work with `subagent`. Two or three tasks in one call run in parallel with read-only tools, which is enough for reading code. Each subagent starts with no context, so put in its task: the absolute repository path, the files it covers, the stated purpose of the change, the checklist from Step 3, and the finding format below. Subagents cannot delegate further. Verify what they return yourself, as in this step, before reporting it.

## Step 5: Look for simplification

Only after the bug pass, and only in code the change touches:

- Code that duplicates something the project or the standard library already provides. Name the existing function.
- Parameters, options, branches, or abstractions that nothing uses.
- Logic that can be expressed in clearly fewer lines without changing behaviour.
- Dead code the change left behind: unused imports, variables, functions.

Leave out personal style preferences and anything a formatter or linter decides.

## Step 6: Report

Rank findings by severity, most severe first:

- **Critical**: data loss or corruption, a security hole, a crash on a common path.
- **High**: wrong result or failure in a realistic case.
- **Medium**: wrong in an uncommon case, or a failure that is handled badly.
- **Low**: simplification and cleanup.

Use this format:

```
## Review: [what was reviewed, e.g. "branch feature/x against main, 6 files"]

Verdict: [safe to merge / fix before merging / needs discussion], in one sentence.

### Findings

1. [Critical] path/to/file.ts:42 - [one-line title]
   What happens: [the concrete scenario: this input or sequence, this line, this wrong result]
   Why: [the cause, in one or two sentences]
   Fix: [the specific change, as a short description or a snippet of a few lines]

2. [High] ...

### Simplifications
- path/to/file.ts:88 - [what to remove or replace, and with what]

### Questions
- path/to/file.ts:120 - [what you could not confirm and what would settle it]

### Not reviewed
- [files or areas skipped, and why]
```

Rules for the report:

- Give the line number in the current version of the file, not a position in the diff.
- One finding per defect. If the same mistake occurs in several places, list all locations under one finding.
- Describe what fails, not what is "better practice". A finding without a failure scenario belongs in Simplifications or nowhere.
- If you found nothing, say so plainly and state what you checked. Do not pad the report.
- Do not praise the code or summarise what it does beyond the one-line review header.

If the user then asks you to apply fixes, change only what the accepted findings require, one finding at a time, and re-read the affected lines after each change.
