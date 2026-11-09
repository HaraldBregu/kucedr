# Knowledge vector service

The Knowledge remote vector database is a plugin script of type `VECTOR`, run the same way
backup runs `backup-s3` (see `BACKUP.md`). The built-in one is
`resources/plugins/bootstrap/scripts/vector-db` (Pinecone). It is only a **mirror**: the local
SQLite store (`src/main/agent/knowledge/rag/sqlite.ts`) still indexes and serves every search.

- **Settings → Scripts → Vector DB**: the API key. It is saved as the bootstrap plugin setting
  `vector-db` (`format: password`, encrypted with `safeStorage` by `savePluginSettings`). Each
  VECTOR script reads the plugin setting named after the script.
- **Settings → Knowledge → Storage**: select the script (`databaseProviderId: 'script'`,
  `databaseId: <script name>`) and give mirror consent. **Configure databases** opens the
  selected script's page.

## Script protocol

Kucedr posts one message on `process.parentPort`:

```json
{
	"operation": "upload",
	"provider": { "apiKey": "..." },
	"indexName": "knowledge",
	"generation": "kucedr-<uuid>",
	"dimensions": 1536,
	"records": [{ "id": "...", "path": "...", "text": "...", "vector": [0.1] }]
}
```

- `operation`: one of the following.
  - `upload`: create the serverless index (AWS us-east-1, cosine) if it is missing, check it,
    then upsert in batches of 64 into the `generation` namespace.
  - `discard`: delete the `generation` namespace.
  - `purge`: delete that `generation`, or, when none is given, every `kucedr-*` namespace.
- Only `id`, `path`, `text` and `vector` of each record leave the app.

The script replies with one message and exits:
- `{ "result": null }` for `upload` and `discard`.
- `{ "result": { "deleted": n } }` for `purge`.
- `{ "error": "..." }` when the operation fails.

## Main process: `src/main/database/`

| File | Responsibility |
|---|---|
| `fork.ts` | `forkVectorScript`: runs a VECTOR script in a `utilityProcess`. An aborted signal kills the child. |
| `vector_script.ts` | `vectorScriptAdapter`: wraps a script as a `VectorDatabaseAdapter` with its API key, consent recipient `['script', name, indexName, apiKey]`, and upload/discard/purge. |
| `vector_adapters.ts` | Lists `pluginScripts('VECTOR')` as vector databases. |
| `vector_connection.ts` | Resolves the selected script and its API key. |

`agent/knowledge/rag/mirror.ts`, `agent/knowledge/rag/recipient.ts` and
`data/data_purge_remote.ts` call these through the adapter interface. `assertCurrent()` runs
before and after the upload rather than between batches; cancelling kills the child process.

## Data flow

```
Scripts → Vector DB ──plugins.saveSettings──▶ plugin secrets (encrypted)
Knowledge → Storage ──saveDatabaseConfiguration──▶ rag_store (databaseId = script name)
rag_index ──▶ mirror ──▶ database/fork ──utilityProcess──▶ vector-db ──▶ Pinecone
search ──▶ local SQLite
```

## Verification

```sh
npm run typecheck:app
npx jest --selectProjects main --testPathPatterns 'tests/unit/main/(rag|ipc/database|data)'
```

Manually:
1. Save the Pinecone key on Settings → Scripts → Vector DB.
2. Select **Bootstrap / Vector DB** in Knowledge → Storage, give consent, and rebuild the index.
3. Check that the `kucedr-<uuid>` namespace appears in Pinecone and that local search still
   returns matches.
