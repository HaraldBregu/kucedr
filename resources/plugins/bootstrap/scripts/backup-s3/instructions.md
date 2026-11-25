# backup-s3

Storage script run by Kucedr in a utility process; it is not an agent tool.

Kucedr posts one message on `process.parentPort`:

```json
{
	"operation": "backup",
	"provider": { "region": "...", "endpoint": "...", "forcePathStyle": false, "bucket": "...", "accessKeyId": "...", "secretAccessKey": "...", "passphrase": "..." },
	"roots": [{ "path": "/Users/me/Documents/notes", "prefix": "notes/" }],
	"protectedRoot": "/Users/me/.kucedr",
	"vaultKey": "..."
}
```

- `operation`: `backup` uploads every file under each root to `<prefix><relative path>`, then deletes the objects under the prefix that no longer exist locally (skipped for a root when any of its files failed); `restore` downloads every object under each prefix back into its root.
- `protectedRoot`: its `settings`, `providers` and `storage` folders are never read or written.
- `provider.passphrase` (optional): each file is encrypted before upload as `"\0kbackup"` ‖ salt (16) ‖ IV (12) ‖ AES-256-GCM ciphertext ‖ tag (16), with the object key as additional data and the key derived by scrypt (N 2^17, r 8, p 1) from the passphrase and one random salt per run. Restore decrypts objects that start with `"\0kbackup"` and restores other objects as they are; a missing or wrong passphrase stops the whole restore.
- `vaultKey` (optional, backup with a passphrase only): base64 key that opens files sealed by Kucedr's encrypted data folder (`"\0kvault1"` ‖ IV (12) ‖ tag (16) ‖ AES-256-GCM ciphertext), so they are uploaded as plaintext inside the passphrase encryption.

The script replies with one message and exits:

- `{ "result": { "uploaded": [...], "deleted": [...], "failed": [{ "path", "error" }] } }` for `backup`.
- `{ "result": { "downloaded": [...], "skipped": [], "failed": [...] } }` for `restore`.
- `{ "error": "..." }` when the operation could not run.
