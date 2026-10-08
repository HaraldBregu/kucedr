import type { StorageBackupSnapshot } from '../../shared/storage_types';
import type { StorageObjectStore } from './remote';
import { backupSnapshotSchema } from './snapshot';

export async function listBackupSnapshots(
	store: StorageObjectStore
): Promise<StorageBackupSnapshot[]> {
	const manifests = (await store.list('kucedr/v2/')).filter((object) =>
		/\/snapshots\/[^/]+\.json$/.test(object.key)
	);
	const result: StorageBackupSnapshot[] = [];
	for (const object of manifests) {
		const snapshot = backupSnapshotSchema.parse(
			JSON.parse(Buffer.from(await store.get(object.key)).toString('utf8'))
		);
		result.push({
			key: object.key,
			folder: snapshot.folder ?? object.key.split('/').slice(2, -2).join('/'),
			createdAt: snapshot.createdAt,
			files: snapshot.files.length,
			bytes: snapshot.files.reduce((total, file) => total + file.size, 0),
		});
	}
	return result.sort(
		(a, b) => b.createdAt.localeCompare(a.createdAt) || b.key.localeCompare(a.key)
	);
}
