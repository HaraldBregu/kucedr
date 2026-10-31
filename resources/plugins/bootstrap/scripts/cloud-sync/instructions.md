# cloud-sync

Storage script run by Kucedr in a utility process; it is not an agent tool.

Kucedr posts one message on `process.parentPort`:

```json
{
	"operation": "backup",
	"provider": { "region": "...", "endpoint": "...", "forcePathStyle": false, "bucket": "...", "accessKeyId": "...", "secretAccessKey": "..." },
	"roots": [{ "path": "/Users/me/Documents/notes", "prefix": "notes/" }],
	"protectedRoot": "/Users/me/.kucedr"
}
```

- `operation`: `backup` uploads every file under each root to `<prefix><relative path>`; `restore` downloads every object under each prefix back into its root.
- `protectedRoot`: its `settings`, `providers` and `storage` folders are never read or written.

The script replies with one message and exits:

- `{ "result": { "uploaded": [...], "failed": [{ "path", "error" }] } }` for `backup`.
- `{ "result": { "downloaded": [...], "skipped": [], "failed": [...] } }` for `restore`.
- `{ "error": "..." }` when the operation could not run.
