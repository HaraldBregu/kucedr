import { app } from '@kucedr/sdk';

export async function runStorageTest(): Promise<string[]> {
	const key = 'demo-storage-test';
	const path = 'demo-storage-test/message.txt';
	const createdValue = { phase: 'created', count: 1 };
	const updatedValue = { phase: 'updated', count: 2 };
	const encoder = new TextEncoder();
	const decoder = new TextDecoder();

	try {
		await app.deleteAppStoreValue(key);
		await app.deleteAppStoreFile(path);

		if ((await app.getAppStoreValue(key)) !== undefined) {
			throw new Error('getAppStoreValue did not return undefined for a missing key');
		}

		await app.setAppStoreValue(key, createdValue);
		if (JSON.stringify(await app.getAppStoreValue(key)) !== JSON.stringify(createdValue)) {
			throw new Error('setAppStoreValue did not store the value');
		}

		await app.setAppStoreValue(key, updatedValue);
		if (JSON.stringify(await app.getAppStoreValue(key)) !== JSON.stringify(updatedValue)) {
			throw new Error('setAppStoreValue did not overwrite the value');
		}

		await app.deleteAppStoreValue(key);
		if ((await app.getAppStoreValue(key)) !== undefined) {
			throw new Error('deleteAppStoreValue did not remove the value');
		}

		let missingFileRejected = false;
		try {
			await app.readAppStoreFile(path);
		} catch {
			missingFileRejected = true;
		}
		if (!missingFileRejected) {
			throw new Error('readAppStoreFile did not reject a missing file');
		}

		await app.writeAppStoreFile(path, encoder.encode('created'));
		if (decoder.decode(await app.readAppStoreFile(path)) !== 'created') {
			throw new Error('writeAppStoreFile did not save the file');
		}

		await app.writeAppStoreFile(path, encoder.encode('updated'));
		if (decoder.decode(await app.readAppStoreFile(path)) !== 'updated') {
			throw new Error('writeAppStoreFile did not overwrite the file');
		}

		await app.deleteAppStoreFile(path);
		missingFileRejected = false;
		try {
			await app.readAppStoreFile(path);
		} catch {
			missingFileRejected = true;
		}
		if (!missingFileRejected) {
			throw new Error('deleteAppStoreFile did not remove the file');
		}

		return [
			'getAppStoreValue: missing, read, overwrite',
			'setAppStoreValue: create, overwrite',
			'deleteAppStoreValue: delete',
			'readAppStoreFile: missing, read, overwrite',
			'writeAppStoreFile: create, overwrite',
			'deleteAppStoreFile: delete',
		];
	} finally {
		await Promise.allSettled([
			app.deleteAppStoreValue(key),
			app.deleteAppStoreFile(path),
		]);
	}
}
