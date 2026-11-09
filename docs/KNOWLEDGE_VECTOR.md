# Knowledge vector service (plan)

Move the Knowledge remote vector database out of the app and into a plugin script, the same
way backup runs `resources/plugins/bootstrap/scripts/backup-s3` (see `BACKUP.md`).

Today `src/main/database/vector_pinecone.ts` and `@pinecone-database/pinecone` ship inside the
app, and the API key lives in Providers → Database. Pinecone is only a **mirror**: the local
SQLite store (`src/main/agent/knowledge/rag/sqlite.ts`) still indexes and serves every search.

Scope:
- Only the mirror moves (`upload`, `discard`, `purge`). Local SQLite indexing and search do not
  change.
- Credentials move to the script detail page, as they did for backup-s3. Pinecone is removed
  from Providers → Database.

## 1. Script type `VECTOR`

- `src/shared/plugin_types.ts`: `PLUGIN_SCRIPT_TYPES = ['UI', 'STORAGE', 'VECTOR']`.
- `pluginScripts('VECTOR')` (`src/main/plugins/scripts/plugin_script_list`) already filters by
  type, so it needs no change.

## 2. Bootstrap script `resources/plugins/bootstrap/scripts/vector-pinecone/`

Uses the same layout as backup-s3: `manifest.json` (`"type": "VECTOR"`, `inputSchema`),
`instructions.md`, `package.json` (esbuild bundle to `dist/index.mjs`, with
`@pinecone-database/pinecone` as a devDependency), and `src/index.mjs`.

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
  - `upload`: create the index if it is missing, check its dimension, metric and region, then
    upsert in batches of 64 into the `generation` namespace.
  - `discard`: delete the `generation` namespace.
  - `purge`: delete that `generation`, or, when none is given, every `kucedr-*` namespace.
- The script keeps the `KUCEDR_GENERATION` guard from `vector_pinecone.ts`.

The script replies with one message and exits:
- `{ "result": null }` for `upload` and `discard`.
- `{ "result": { "deleted": n } }` for `purge`.
- `{ "error": "..." }` when the operation fails.

The body of `vector_pinecone.ts` moves into the script unchanged. The build is wired into
`electron.vite.config.ts` and `package.json` wherever `backup-s3` is.

## 3. Main process

| File | Change |
|---|---|
| `src/main/database/fork.ts` (new) | Same shape as `src/main/backup/fork.ts`. It finds `pluginScripts('VECTOR')` by `databaseId`, forks a `utilityProcess`, posts the message, and resolves or rejects on the reply or exit. An aborted `signal` calls `child.kill()`. |
| `vector_adapters.ts` | `listVectorDatabases()` maps VECTOR scripts to `VectorDatabaseService` (`providerId: 'script'`, `databaseId: script.name`, names from the script title). |
| `vector_connection.ts` | Reads the API key from the script's saved secret (section 4), not from `getProvider(..., 'databases')`. |
| `agent/knowledge/rag/mirror.ts` | `upload` / `discard` call the fork. `assertCurrent()` runs in main before and after the fork. |
| `data/data_purge_remote.ts` | `purge` calls the fork. |
| `agent/knowledge/rag/recipient.ts` | The mirror recipient becomes `['script', script.name, indexName, apiKey]`, hashed as before. Existing mirror consent is invalidated once, which is intended. |
| `vector_pinecone.ts`, `fetch.ts` | Deleted (`fetch.ts` only if nothing else uses it). |
| `package.json` | Drop `@pinecone-database/pinecone`. |
| Vector-database catalog (`loadVectorDatabases` source) | Drop the Pinecone entry. |

Trade-off: the per-batch `assertCurrent()` that used to run inside the upsert loop is lost.
Aborting kills the child process, which covers the cases that matter.

If the vector fork and the backup fork end up identical apart from their payload, extract one
`runScript(script, message, signal)` into `src/main/plugins/scripts/run.ts` and use it in both.
Otherwise keep them separate.

## 4. Credentials (script detail page)

- `src/renderer/src/pages/settings/pages/scripts/details/Page.tsx` renders a small
  `VectorConfiguration` when `script.type === 'VECTOR'`, next to the STORAGE `Configuration`. It
  has one API key field (shadcn `Input` and `Button`, like `StorageForm`).
- The key goes into the existing encrypted plugin-secrets store
  (`src/main/plugins/plugins_settings.ts`, `pluginsStore.secrets`, `safeStorage`), keyed by the
  script name. Use the existing plugin-settings IPC if it fits; otherwise add one trusted
  `scripts.saveSecret` / `scripts.hasSecret` pair. The key is never sent back to the renderer.
- Knowledge → Storage (`pages/knowledge/Storage.tsx`) keeps its select, which now lists VECTOR
  scripts. **Configure databases** links to `/settings/scripts/<name>`, as Cloud → Configure
  does.

## 5. Data flow

```
Scripts → vector-pinecone ──saveSecret──▶ plugin secrets (encrypted)
Knowledge → Storage ──saveDatabaseConfiguration──▶ rag_store (databaseId = script name)
rag_index ──▶ mirror ──▶ database/fork ──utilityProcess──▶ vector-pinecone ──▶ Pinecone
search ──▶ local SQLite (unchanged)
```

## 6. Tests to update

These tests reference the removed adapter or the Pinecone provider. Mock the fork in them
instead of the adapter:
- `tests/unit/main/rag/mirror.test.ts`
- `tests/unit/main/rag/rag-database-store.test.ts`
- `tests/unit/main/ipc/database.test.ts`
- `tests/unit/main/data/data-remote.test.ts`
- `tests/unit/renderer/knowledge-settings.test.tsx`
- the providers tests that list Pinecone

## Verification

```sh
npm run typecheck:app
npx jest --selectProjects main tests/unit/main/rag tests/unit/main/ipc/database.test.ts tests/unit/main/data
```

- `npm run build` in `vector-pinecone/` produces `dist/index.mjs`.
- The app bundle no longer contains `@pinecone-database` (grep `out/`).

Manually:
1. Save the Pinecone key on Settings → Scripts → Vector Pinecone.
2. Select it in Knowledge → Storage, give consent, and rebuild the index.
3. Check that the `kucedr-<uuid>` namespace appears in Pinecone and that local search still
   returns matches.
4. Run purge remote and check that the namespaces are deleted.
