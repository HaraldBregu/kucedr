import path from 'node:path';
import { userDataLocation } from '../shared/user_data_location';
import { realPath } from '../shared/real_path';

export function isProtectedStoragePath(value: string): boolean {
	const resolved = realPath(value);
	const root = realPath(userDataLocation());
	const settings = path.join(root, 'settings');
	const providerCatalog = path.join(root, 'providers');
	const storage = path.join(root, 'storage');
	return (
		resolved === storage ||
		resolved.startsWith(`${storage}${path.sep}`) ||
		resolved === settings ||
		resolved.startsWith(`${settings}${path.sep}`) ||
		resolved === providerCatalog ||
		resolved.startsWith(`${providerCatalog}${path.sep}`)
	);
}
