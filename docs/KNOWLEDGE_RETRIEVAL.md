# Knowledge retrieval — how the agent uses the knowledge base, fast

> **Status:** steps 1–5 built 2026-11-24; step 6 waits for traces. See [Landed](#landed-2026-11-24) at the end. Roadmap [Memory and knowledge](roadmap/MEMORY.md), 18.6. "What exists today" below describes the code before that change.

## The question

Should the agent reach the knowledge base through a tool, or should the knowledge be loaded on every run? And how is it made as fast as possible?

**Answer: neither alone.**
- Always tell the agent what the knowledge base holds, and fetch content only when needed. The split is the same one memory already follows.
- For speed, the costs to cut are model turns first, then the search itself, then reindexing. A model turn takes seconds ([PARALLEL_TOOLS.md](PARALLEL_TOOLS.md)); a search should take milliseconds.

| | Size | How often it is relevant | How it reaches the model |
| --- | --- | --- | --- |
| Memory | Small, curated | Almost every run | Loaded every run (run context) |
| Knowledge | Large, up to 20,000 files | Some runs | **A short card every run, plus content through a tool** |

## Options compared

| Option | Good | Bad | Verdict |
| --- | --- | --- | --- |
| **Load all knowledge every run** | Nothing to search | Works only for a tiny knowledge base. It fills the context, costs input tokens on every run and slows every turn. | No |
| **Search on every message and attach the hits** | The model never forgets to look | An embedding call on every message, even "thanks". Irrelevant excerpts distract the model and add tokens. The message is used as the query, and it is often a poor one. | No |
| **Tool only** (today) | Costs nothing when unused. The model writes good queries. | The model has to know there is something to search, and today it must also find the tool first. | Keep, but fix awareness |
| **Card every run + tool** | Cheap, cache-friendly, and the model knows when to look | One short block per run | **Recommended** |

## What exists today (checked in code)

**Awareness**
- `query_knowledge` (`src/main/agent/tools/knowledge/query_knowledge.ts`) is the only way in.
- It is not in the always-loaded set (`runner/run_stream.ts:331-356`). With tool search on, the model spends a whole model turn on `tool_search` before it can search.
- Neither the system prompt nor the run context mentions knowledge, so the model rarely thinks to search.

**Search** (`rag/rag_search.ts`, `rag/sqlite.ts:181-197`)
- Every query does all of this:
  - reads the manifest file from disk;
  - opens SQLite;
  - loads **every** row of the active generation, text and vector, decoding each vector twice into a `number[]`;
  - scores every row with a cosine that recomputes both norms;
  - sorts everything;
  - closes the store.
- All of it runs on the main process, which also serves the UI's IPC.
- There is vector search only, which is weak on names, codes, numbers and exact phrases.
- Results include fields the model does not use (`checksum`, `indexedAt`, `sourceId`).
- A result's path is relative to the folder's name, so `read` cannot open it, and there is no way to see the text around a hit.

**Reindexing** (`rag/source.ts`, `rag/rag_index.ts`)
- Every run re-reads and re-extracts every file, PDFs included. That is needed only to compute the fingerprint that proves the file is unchanged.
- Every run copies every row, unchanged ones included, into a new generation, then deletes the old one.
  - At the limit that rewrites about 120 MB of vectors and 40 MB of text.
  - It also holds every vector in memory as a `number[]`.
- Files are extracted one after another, and each PDF starts its own worker.
- Embedding batches are sent one at a time.

### Measured (2026-11-24, Node 24.16, Apple M5 Pro, 20,000 chunks × 1,536 dimensions)

| Search step | Time |
| --- | --- |
| Today's path (read all rows, decode, cosine, sort) | **846 ms** per query |
| One-time load into one normalized `Float32Array` (123 MB) | 182 ms |
| In-memory dot product, top 50 | **18–26 ms** per query |
| Same scan on `int8` vectors (31 MB) | 25 ms |
| FTS5 BM25, top 50 | 13 ms |

Today's 846 ms comes on top of the embedding network call, and it blocks the main process for that whole time.

## Targets

| What | Today | Target |
| --- | --- | --- |
| Model turns before the first search | 1 (`tool_search`) | 0 |
| Model turns for three phrasings of one question | 3 | 1 |
| Search time besides the embedding call, at 20,000 chunks | ~850 ms | ≤ 30 ms |
| Main process blocked per search | ~850 ms | < 5 ms |
| Reindex with nothing changed, 20,000 files | Re-reads, re-extracts and rewrites everything | Only checks each file's size and modification time: seconds |
| Reindex after one file changed | Same as above | Extracts and embeds that file only |

## Plan

### Step 1 — Make the agent aware (S)

1. **Knowledge card in the run context.**
   - When Knowledge is enabled and an index exists, `buildRunContext` adds a `## Knowledge` section with:
     - the folder names;
     - the file and chunk counts;
     - the formats present;
     - the date of the last index.
   - It also adds one instruction: search with `query_knowledge` before answering anything that may involve these documents.
   - It is about 150 tokens, built from `readRagManifest` and the index row.
   - It changes only after a reindex, so the cached prompt prefix stays valid ([PROMPT_CACHE.md](PROMPT_CACHE.md), step 2).
2. **Load `query_knowledge` by default** when `getKnowledgeTools()` returns it: add it to `requiredIds` in `run_stream.ts`. This saves the `tool_search` turn.

**Check:** with the mock model in the built app, the first request of a run contains the card and the tool. In traces, the first knowledge question calls `query_knowledge` on the first turn.

### Step 2 — Fast search (M)

1. **A long-lived search worker.**
   - A `?nodeWorker` worker, the same pattern as the PDF worker, holds the active generation as one normalized `Float32Array`, so cosine becomes a plain dot product.
   - It also keeps the row ids in the same order.
   - It reloads only when `publish` changes the generation.
   - The main process sends the query vector and gets back ids and scores, so the 123 MB stays off the main heap and the UI stays responsive.
2. **Fetch text only for the hits.** The worker returns the top ids, and one `SELECT … WHERE id IN (…)` reads their text and line ranges. Nothing else is read per query.
3. **Warm up early.**
   - Start loading the worker at run start whenever Knowledge is enabled. The model's first turn takes longer than the 182 ms load.
   - Cache the configuration and manifest checks per generation instead of reading files on every query.
4. **Cache query embeddings.** Keep the last 256 embeddings in a map keyed by provider, model and text. Repeated searches in a chat then skip the network.
5. **Smaller results.**
   - Return only `chunkId`, `path`, `section`, `range`, `score` and `excerpt`, as compact JSON.
   - Fewer tokens make every later turn in the run faster.

**Check:** at 20,000 chunks, a search takes ≤ 30 ms besides the embedding call, with the time logged in the trace. A main-process timer shows no gap above 5 ms during a search.

### Step 3 — Keyword search next to vectors (M)

1. **The FTS5 table.**
   - Add `rag_chunks_fts`, an FTS5 external-content table over `rag_chunks.text`, so the text is not stored twice.
   - It is kept in step with the chunks in the same transaction as `publish`.
   - FTS5 needs no new dependency: `node:sqlite` ships it (confirmed on Node; confirm in the Electron build).
2. **Run both searches and merge.**
   - BM25 runs **while** the query embedding is in flight, so it adds no time.
   - The two rankings are merged with reciprocal rank fusion (`1 / (60 + rank)`).
   - Cosine hits must pass `minimumScore`. Keyword hits count because their terms matched.
3. The text is already stored, so building the table needs no new embedding.

**Check:** in a fixture index, an exact code that appears in one file is missed by vectors alone and found by the merged search. The total time does not grow.

### Step 4 — Fast reindexing (M)

1. **Skip unchanged files without reading them.**
   - Store each source's size and modification time.
   - When both match, and the folder and embedding settings are unchanged, reuse its rows without reading or extracting the file.
   - Only changed and new files go through extraction.
2. **Write only what changed.**
   - In one transaction, `publish` inserts the rows of changed sources and deletes the rows of changed and removed sources.
   - Unchanged rows are left alone, and reused vectors are never decoded.
   - The generation stays as the index's version id for the manifest and the remote mirror. Rows are no longer copied per generation.
   - See the open decision on the schema change.
3. **Extract in parallel.** Extract up to 4 files at a time, and reuse one PDF worker for the whole run instead of starting one per file.
4. **Embed in parallel.**
   - Send up to N batches at a time, where N comes from the embedding model's manifest and defaults to 2. This follows the rule against provider code in `src`.
   - The cross-file batching and the per-request timeout stay as they are.

**Check:** a 2,000-file fixture.
- A second run with nothing changed reads no file contents and makes no embedding call.
- Touching one file re-extracts and re-embeds only that file.
- Compare the time of a full run before and after.

### Step 5 — Fewer turns per question (S)

1. **Several phrasings in one call.**
   - `query_knowledge` accepts `queries` with up to 3 strings, embedded in **one** request and searched together.
   - Duplicate hits are dropped.
   - The model gets in one turn what takes three today.
2. **Read around a hit.**
   - An optional `chunkId` returns that chunk with up to two neighbours on each side, from the same source by `chunk_index`.
   - The model can read on without file access to the knowledge folders.

**Check:** one call with three phrasings makes one embedding request. Expanding a hit returns contiguous line ranges.

### Step 6 — Only if traces show it is needed: free hints (S)

- If the model still skips searches it should run, add a local FTS5 search (no model call, about 13 ms) over the user's message at run start.
- When it scores strongly, the run context lists up to three **file names** that look relevant. It never includes their content. The model still decides whether to call the tool.

## Order

1 → 2 → 3 → 5, then 4.
- Steps 1 and 2 remove the biggest delays the user feels: a model turn and about 850 ms per search.
- Step 4 matters most for large folders on a schedule.
- Step 6 waits for traces.

## Not planned

- **Loading the whole knowledge base**, or attaching hit content to every message. See the comparison above.
- **A reranking model.** It adds a model call and latency to every search. Revisit if step 3's results are still poor.
- **An ANN library** (sqlite-vec, HNSW) and a new dependency. A brute-force scan in memory reaches the target at the 20,000-chunk limit. Revisit only if the limit is raised.
- **A file watcher** for instant reindexing. The schedule and step 4 make reindexing cheap enough.
- **Knowledge in Voice.** `query_knowledge` is model-backed, so it stays out of Voice ([voice rule](roadmap/VOICE.md)).

## Open decisions

- ~~**Schema change for step 4.**~~ Not needed. `publish` moves reused rows to the new generation in place (see Landed), so `rag_chunks` keeps its columns and existing rows.
- **`int8` vectors.**
  - They would cut the worker's memory from 123 MB to 31 MB at the limit, at the same speed, with the top 50 rescored from the stored `Float32` vectors.
  - Add this only if memory turns out to matter; typical indexes are far below the limit.
- **Folder descriptions.**
  - A line per folder written by the user would make the card more useful.
  - It needs a field in Knowledge settings. Recommended after step 1, if the card alone proves too thin.
- **Keyword-only search in Voice.**
  - Step 3's FTS search calls no model, so a Voice tool could use it without breaking the no-model-backed-tools rule.
  - This is a product decision for the user.

## Landed (2026-11-24)

### What was built

**Step 1, awareness**
- `knowledge/rag/card.ts` builds the card.
  - It is cached per index generation, completion time and folder list.
  - It returns nothing when Knowledge is off, has no index, or SQLite fails.
- `buildRunContext` takes it as a fourth argument. `run_stream.ts` adds it only when `query_knowledge` is eligible for the run, and lists the tool in `requiredIds`.

**Step 2, fast search**
- `SqliteVectorStore.search` keeps the active generation as one normalized `Float32Array` per store instance and returns `{ id, score }` only.
  - The cache key is the index name, generation and completion time.
  - `warm()` loads it without a query.
- `chunks(ids)` reads the text of the hits only, through `json_each`.
- `rag/worker.ts` (`?nodeWorker`) holds one store. `rag/scan.ts` talks to it:
  - The worker is unref'd.
  - A request aborts with its signal.
  - A crash rejects the waiting requests, and the next search starts a new worker.
- `warmRag()` starts the load at run start.
- `searchRag` caches up to 256 query embeddings, keyed by provider, model and text.
- The tool result is `{ results: [{ chunkId, path, section?, lines, excerpt }], limitations, abstain }`. The path header is cut from the excerpt.

**Step 3, keyword search**
- `rag_chunks_fts` is an FTS5 external-content table over `rag_chunks.text`. `publish` and `purge` rebuild it.
- `ftsQuery` (`rag/terms.ts`) turns a query into OR'ed quoted terms. Codes like `ACME-4217` stay one phrase.
- Keyword search runs while the embedding request is in flight. The results are merged with vector hits by reciprocal rank fusion (k = 60), from 50 candidates per list.

**Step 4, fast reindexing**
- A new table, `rag_sources`, stores each source's size, modification time, stamp (chunk version and embedding recipient) and fingerprint.
  - A file whose size and modification time match, with the same stamp and rows still in the index, is reused without reading it.
  - A file whose time changed but whose text did not is still reused by its fingerprint.
- `publish` no longer re-inserts reused rows. It moves them to the new generation with one `UPDATE` per source, inside the same transaction, so a failed run still leaves the old index active.
  - No existing table changed shape, and no migration was needed.
- The mirror path still uploads every record, so it reads the reused rows for the upload only.
- The collector extracts 4 files at a time and keeps them in order.
- Embedding sends up to `metadata.concurrency` requests at once (default 2), read from the model manifest.

**Step 5, fewer turns**
- `query_knowledge` takes `queries` (up to 3), still accepts `query`, and accepts `chunkId`, which returns the chunk with up to two neighbours on each side (`aroundRag`).

### Not built

- **Caching the configuration and manifest checks.** Opening the store takes 0.4 ms and the checks read one small file, so there was nothing to gain.
- **Reusing one PDF worker per run.**
  - Measured: a new worker plus the pdfjs import cost about 70 ms per PDF (88 ms against 20 ms to parse once warm).
  - Unchanged PDFs are no longer opened at all, so this applies only to new or changed PDFs: about 18 s per 1,000 new PDFs with 4 extracted at a time.
  - A pool would also have to handle timeouts, crashes and memory growth. Revisit if first indexing of large PDF libraries matters.
- **Step 6.** It waits for traces.

### Measured (Apple M5 Pro, Electron 44 / Node 24.21)

| What | Before | After |
| --- | --- | --- |
| Vector search, 20,000 × 1,536 | 846 ms on the main process | 18 ms in the worker; the main thread never paused more than 0.5 ms |
| Worker warm-up at that size | — | 187 ms, once per index generation |
| Keyword search, 20,000 chunks | — | 10 ms (exact code ranked first); 26 ms for four common words |
| Text for 5 hits | Every row read | 1.8 ms |
| Reindex, 2,000 files, nothing changed | Every file re-read and re-extracted, every row rewritten | 184 ms, no file read, no embedding request |
| Reindex, one file touched (same text) | Same as above | 1 file read, no embedding request |
| Reindex, one file changed | Same as above | 1 file read, 1 embedding request |
| Publish at the limit, 1 of 2,000 sources changed | Full rewrite | 383 ms, keyword index rebuild included |
| Two phrasings in one call | 2 model turns, 2 requests | 1 turn, 1 embedding request |

### Checked

- **The built app**, with an isolated profile, a mock chat model and the embedding call stubbed inside the main process (no real key):
  - Indexing 41 files made one embedding request. Reindexing them unchanged made none and took 9 ms.
  - The first turn of a chat offered `query_knowledge`, and its run context held the card.
  - A search through the worker ranked the file containing `ACME-4217` first.
  - Reading around that hit returned the passage.
- **The full main test suite** against the commit before this work: no new failures. The knowledge tests that were updated pass.
- **Not checked:**
  - a real embedding provider;
  - the remote mirror path with reused sources;
  - the packaged app (asar plus the new worker chunk);
  - Windows and Linux.
- **Existing indexes** fill the keyword table and source stamps on their next index run. Until then search uses vectors only, and that run still reads every file once.
