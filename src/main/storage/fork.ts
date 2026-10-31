import path from 'node:path';
import { utilityProcess } from 'electron';
import type { StorageOperation } from '../../shared/storage_types';
import { pluginScripts } from '../plugins';
import { userDataLocation } from '../shared/user_data_location';
import { storageProviders } from './providers';
import { transferRoots } from './roots';
import { storagePrefix } from './storage_prefix';
import { getStorageSettings } from './storage_store';

/** Runs the storage plugin's sync script in a utility process and returns its result. */
export async function forkSync<T>(operation: StorageOperation): Promise<T> {
	const [script] = pluginScripts('STORAGE');
	if (!script) throw new Error('No storage sync script available.');
	const settings = getStorageSettings();
	const provider = storageProviders.resolve(settings.providerId);
	const roots = transferRoots(settings.paths).map((root) => ({ path: root, prefix: storagePrefix(root) }));
	if (!roots.length) {
		throw new Error(
			operation === 'backup'
				? 'Select at least one folder to upload.'
				: 'Select at least one folder to download into.'
		);
	}
	const child = utilityProcess.fork(
		path.join(script.directory, ...script.metadata.entry.split('/')),
		[],
		{ cwd: script.directory, serviceName: `${script.title} (${script.plugin.name})` }
	);
	return new Promise<T>((resolve, reject) => {
		child.once('message', (reply: { result?: T; error?: string }) => {
			child.kill();
			if (reply.error !== undefined) reject(new Error(reply.error));
			else resolve(reply.result as T);
		});
		child.once('exit', (code) => reject(new Error(`${script.title} exited with code ${code}.`)));
		child.postMessage({ operation, provider, roots, protectedRoot: userDataLocation() });
	});
}
