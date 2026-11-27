import { existsSync } from 'node:fs';
import path from 'node:path';
import { isSafeStorageAvailable } from '../shared/safe_storage';
import { userDataLocation } from '../shared/user_data_location';
import { setVault } from './state';

// A new install starts with encryption on. An install with chats or a saved choice keeps what it
// has. Needs the system keystore, so it runs once the app is ready.
export function enableVaultOnFreshInstall(): void {
	const data = userDataLocation();
	if (existsSync(path.join(data, 'settings', 'vault.json')) || existsSync(path.join(data, 'sessions'))) return;
	if (isSafeStorageAvailable()) setVault(true);
}
