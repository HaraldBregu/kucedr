# Knowledge retrieval — how the agent uses the knowledge base

> **Status:** plan, 2026-11-24. No code yet. Roadmap [Memory and knowledge](roadmap/MEMORY.md), 18.6.

## The question

Should the agent reach the knowledge base through a tool, or should the knowledge be loaded on every run?

**Answer: neither alone.** Always tell the agent what the knowledge base holds, but fetch content only when it is needed. The split is the same one memory already follows:

| | Size | How often it is relevant | How it reaches the model |
| --- | --- | --- | --- |
| Memory | Small, curated | Almost every run | Loaded every run (run context) |
| Knowledge | Large, up to 20,000 files | Some runs | **A short card every run, plus content through a tool** |

## What exists today (checked in code)

- **Tool only.** `query_knowledge` (`src/main/agent/tools/knowledge/query_knowledge.ts`) is the only way in. Nothing about knowledge is loaded into a run.
- **The agent does not know the knowledge base exists.**
  - `query_knowledge` is not in the always-loaded set (`runner/run_stream.ts:331-356`), so with tool search on, the model first has to find it with `tool_search`.
  - Neither the system prompt nor the run context mentions knowledge, its folders or its size.
  - The likely result is that the model rarely searches the user's documents, even when the question is about them.
- **Vector search only** (`rag/sqlite.ts:181-197`).
  - Names, codes, numbers and exact phrases ("invoice 2024-117", "ACME-42") are where embeddings are weakest. There is no keyword search to catch them.
- **Every query reads the whole index.** Each search opens SQLite, loads every vector BLOB of the active generation, scores them all in JavaScript and closes the store (`rag_search.ts`).
  - At the limit (20,000 chunks × 1,536 dimensions) that is about 120 MB read per query.
- **Results are dead ends.**
  - A result is a 2,000-character excerpt with a path like `Notes/plans/q3.md`, which is relative to the folder's name and not to a real location. `read` cannot open it.
  - There is no way to see the text before or after a hit.
- **The score floor is fixed** at a cosine of 0.25 (`rag_store.ts:30`), whatever the embedding model.

## Options compared

| Option | Good | Bad | Verdict |
| --- | --- | --- | --- |
| **Load all knowledge every run** | Nothing to search | Works only for a tiny knowledge base. It fills the context and costs input tokens on every run. | No |
| **Search on every message and attach the hits** | The model never forgets to look | An embedding call on every message, even "thanks". Irrelevant excerpts distract the model. The message is used as the query, and it is often a poor one. | No |
| **Tool only** (today) | Costs nothing when unused. The model writes good queries and can search again. | The model has to know there is something to search | Keep, but fix awareness |
| **Card every run + tool** | Cheap, cache-friendly, and the model knows when to look | One extra short block per run | **Recommended** |

## Plan

### Step 1 — Make the agent aware (S, highest value)

1. **Knowledge card in the run context.**
   - When Knowledge is enabled and an index exists, `buildRunContext` adds a `## Knowledge` section with:
     - the folder names;
     - the file and chunk counts;
     - the formats present;
     - the date of the last index.
   - It also adds one instruction: search with `query_knowledge` before answering anything that may involve these documents, and try another phrasing when the first search finds nothing.
   - The card changes only after a reindex, so the run context stays stable and cache-friendly ([PROMPT_CACHE.md](PROMPT_CACHE.md), step 2).
   - Build it from `readRagManifest` and the index row; no new storage is needed.
2. **Load `query_knowledge` by default** when `getKnowledgeTools()` returns it: add it to `requiredIds` in `run_stream.ts`, so the model doesn't have to find it with `tool_search` first.

**Check:** in the built app with the mock model, the first request of a run contains the card and the tool. In real traces, record how often `query_knowledge` is called before and after the change, on questions about indexed documents.

### Step 2 — Better search (M)

1. **Keyword search next to vector search.**
   - Add an FTS5 table (`rag_chunks_fts`) over the chunk text. It is written in the same `publish` transaction and keyed by index name and generation.
   - `search` runs BM25 and cosine, then merges the two rankings with reciprocal rank fusion (`1 / (60 + rank)`).
   - This needs no new dependency: `node:sqlite` ships FTS5 (confirmed on Node; confirm in the Electron build).
   - The text is already stored, so building the table needs no new embedding. Existing indexes fill it on their next run.
2. **Keep vectors in memory.**
   - Hold the active generation as one `Float32Array` per index in the main process, and reload it only when `publish` changes the generation.
   - Searching 20,000 chunks by brute force then takes tens of milliseconds and reads nothing from disk.
   - Skipped: sqlite-vec or another ANN library. Add one only when an index grows past these limits.
3. **Score floor:** cosine is still filtered with `minimumScore`. A keyword-only hit is accepted because its terms matched.

**Check:** a fixture index where an exact code appears in one file. Vector search alone misses it; the merged search finds it. Time a 20,000-chunk search.

### Step 3 — Read around a hit (S)

- `query_knowledge` gains an optional `chunkId`. Given only that, it returns the chunk with up to two neighbours on each side, taken from the same source by `chunk_index`.
- The model can then read a section or the rest of a page without file access to the knowledge folders.
- Each result also includes `section` (`page 3`, `sheet Budget`), which the citation header already holds.

**Check:** a hit in the middle of a long document is expanded, and the returned line ranges are contiguous.

### Step 4 — Only if traces show it is needed: free hints (S)

- If step 1 still leaves the model skipping searches it should run, add a local keyword search (FTS5 only, no model call, no cost) over the user's message at run start.
- When it scores strongly, the run context lists up to three **file names** that look relevant. It never includes their content. The model still decides whether to call the tool.

## Not planned

- **Loading the whole knowledge base**, or attaching hit content to every message. See the comparison above.
- **A reranking model.** It adds a model call and latency to every search. Revisit if step 2's results are still poor.
- **Knowledge in Voice.** `query_knowledge` is model-backed, so it stays out of Voice ([voice rule](roadmap/VOICE.md)). See the open decision below.

## Open decisions

- **Folder descriptions.** A line per folder written by the user ("contracts with suppliers since 2021") would make the card much more useful. It needs a field in Knowledge settings. Recommended after step 1, if the card alone proves too thin.
- **Keyword-only search in Voice.** The step 2 FTS search calls no model, so a Voice tool could use it without breaking the no-model-backed-tools rule. This is a product decision for the user.
