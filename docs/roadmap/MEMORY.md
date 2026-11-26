# 18. Memory and knowledge

Part of the [Roadmap](README.md). Status: proposal.

## What exists today

- Memory is built automatically from chats (`src/main/memory`). The Settings page is configuration
  only, "not a memory-file editor" ([Settings](../ui/SETTINGS.md)), so the user cannot see or
  correct what the agent remembers from inside the app.
- Forgetting happens later in the background; the model has no tool to remember or forget on
  request ([FEATURES.md](../FEATURES.md)) _(not verified in code)_.
- Knowledge is a local store with an optional remote mirror and a consent step
  ([KNOWLEDGE_VECTOR.md](../KNOWLEDGE_VECTOR.md)). Its refresh runs only while the app is open.

## Features

| # | Feature | What the user gets | Builds on | Size |
| --- | --- | --- | --- | --- |
| 18.1 | See and edit memory | A page listing what the agent remembers, where each item came from, with edit and delete. **Built 2026-11-25**: Settings › Memory lists each `MEMORY.md` record with its section, source chat (a `kucedr:source` marker stamped by the generator and `remember`) and date; edit and delete go through the module's lock. Checked in the app with memory seeded by a mock model; races with the generator checked against the service | The memory files | M |
| 18.2 | Remember and forget in chat | "Remember this" and "forget that" take effect at once and say what changed. **Built 2026-11-25**: `remember` and `forget` tools in main chats (explicit request only, permission configurable) return the saved or deleted facts. Checked in the app with a mock model calling both | The memory module | S–M |
| 18.3 | Memory per workspace | Work and personal memory kept apart | [Multiple workspaces](WORKSPACES.md), 10.2 | M |
| 18.4 | Knowledge sources at a glance | Each source shows when it was last indexed, how much it holds, and any error | Built 2026-11-26: each configured source folder shows its indexed file and passage counts, last index time, and indexing error or skipped-file count. Counts come from the active vector index and errors from the latest indexing run | S |
| 18.5 | Refresh while closed | Knowledge stays current when the window is closed | Run while closed ([Automation](AUTOMATION.md), 16.7) | L |
| 18.6 | Agent uses knowledge well | The agent knows what the knowledge base holds, finds exact names and codes, searches in milliseconds and reindexes only what changed ([KNOWLEDGE_RETRIEVAL.md](../KNOWLEDGE_RETRIEVAL.md)). **Built 2026-11-24** (steps 1–5) | `query_knowledge`, the vector store | L |

## Open decisions

- **Deleting a chat** should also remove what was remembered from it ([Privacy](PRIVACY.md), 1.1).
- **Local embedding** for knowledge is in [Local models and offline use](LOCAL.md), 15.3.
