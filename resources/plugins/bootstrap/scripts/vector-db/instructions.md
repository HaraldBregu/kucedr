# vector-db

Vector script run by Kucedr in a utility process; it is not an agent tool. It mirrors the
Knowledge index to Pinecone. Search stays on the local SQLite index.

Kucedr posts one message on `process.parentPort`:

```json
{
	"operation": "upload",
	"provider": { "apiKey": "..." },
	"indexName": "knowledge",
	"generation": "kucedr-<uuid>",
	"dimensions": 1536,
	"records": [{ "id": "...", "path": "notes/a.md", "text": "...", "vector": [0.1] }]
}
```

- `upload`: creates the serverless index (AWS us-east-1, cosine) if missing, checks its dimension, metric and location, then upserts records in batches of 64 into the `generation` namespace.
- `discard`: deletes the `generation` namespace.
- `purge`: deletes `generation`, or every `kucedr-*` namespace when it is omitted. The index itself is never deleted.

The script replies with one message and exits:

- `{ "result": null }` for `upload` and `discard`.
- `{ "result": { "deleted": n } }` for `purge`.
- `{ "error": "..." }` when the operation could not run.
