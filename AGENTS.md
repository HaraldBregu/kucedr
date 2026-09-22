# AGENTS.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- Do not over-engineer the solution; actively look for the simplest solution that satisfies the request.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- Use established design patterns when they prevent tangled control flow or repeated ad hoc logic; don't add patterns preemptively.
- Use dependency injection when it makes dependencies explicit, improves readability, or simplifies testing; avoid hidden globals and hard-coded service construction in business logic.
- Default to a module-based file structure. Split code into separate files when responsibilities diverge, and move any function or component reused by multiple modules into its own shared file.
- Implement one function per file maximum.
- Use a one-word filename in 99% of cases; use longer names only when existing conventions or clarity require it.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- Don't add code comments unless the user explicitly asks for them.
- If you notice unrelated dead code, mention it - don't delete it.
- When implementing a new feature, do not use patch-style or workaround implementations; implement the requested behavior directly in the relevant code, and do not create or run migrations unless explicitly requested.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Frontend Design

**Use the selected framework's design system first.**

- Follow the design guidelines, components, spacing, states, and interaction patterns of the selected frontend framework or UI library.
- Don't invent custom visual patterns, components, or styling conventions unless the framework cannot reasonably support the required behavior.

## 5. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

- Use subagents for independent parallel tasks, such as separate research, implementation, review, or verification tracks. Keep tightly coupled decisions in the main thread.

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

## Codex Auto-Commit Hook

This repo manages Codex auto-commit from `.codex` only. The hook entry is configured in `.codex/hooks.json` and runs `.codex/hooks/auto-add-commit-push.sh`.

- It runs `git add -A`, skips commits when there are no changes, and unstages common secret patterns (`*.env`, `*.pem`, `*.key`, `credentials.json`).
- It uses `git rev-parse --show-toplevel` to locate the repo root.
- It uses `CODEX_TOOL_NAME` (if set) to tag the commit subject.
- After each tool use that changes the worktree, add, commit, and push the resulting changes.
