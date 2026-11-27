import path from 'node:path';
import { utilityProcess } from 'electron';
import type { StorageOperation } from '../../shared/storage_types';
import { pluginScripts } from '../plugins';
import { userDataLocation } from '../shared/user_data_location';
import { storageProviders } from '../storage/providers';
import { transferRoots } from '../storage/roots';
import { storagePrefix } from '../storage/storage_prefix';
import { getStorageSettings } from './store';
import { backupPaths } from './paths';
import { requireUnrestrictedNetwork } from '../privacy/state';
import { convertVault } from '../vault/convert';
import { vaultKey } from '../vault/key';
import { isVaultEnabled, sealedVaultKey } from '../vault/state';

/** Runs the selected STORAGE script in a utility process and returns its result. */
export async function forkSync<T>(operation: StorageOperation): Promise<T> {
	requireUnrestrictedNetwork();
	const settings = getStorageSettings();
	const script = pluginScripts('STORAGE').find((entry) => entry.name === settings.serviceId);
	if (!script) throw new Error('Select a storage service for backup.');
	const provider = storageProviders.resolve(settings.providerId);
	const roots = transferRoots(backupPaths(settings)).map((root) => ({
		path: root,
		prefix: storagePrefix(root),
	}));
	if (!roots.length) {
		throw new Error(
			operation === 'backup'
				? 'Select at least one folder to upload.'
				: 'Select at least one folder to download into.'
		);
	}
	const key =
		operation === 'backup' && provider.passphrase && sealedVaultKey()
			? vaultKey().toString('base64')
			: undefined;
	const child = utilityProcess.fork(
		path.join(script.directory, ...script.metadata.entry.split('/')),
		[],
		{ cwd: script.directory, serviceName: `${script.title} (${script.plugin.name})` }
	);
	const reply = await new Promise<{ result?: T; error?: string }>((resolve, reject) => {
		child.once('message', (message: { result?: T; error?: string }) => {
			child.kill();
			resolve(message);
		});
		child.once('exit', (code) => reject(new Error(`${script.title} exited with code ${code}.`)));
		child.postMessage({
			operation,
			provider,
			roots,
			protectedRoot: userDataLocation(),
			vaultKey: key,
		});
	});
	if (operation === 'restore' && isVaultEnabled()) convertVault();
	if (reply.error !== undefined) throw new Error(reply.error);
	return reply.result as T;
}
