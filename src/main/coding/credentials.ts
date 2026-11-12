import { safeStorage } from 'electron';
import { mkdirSync, existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import path from 'node:path';
import { userDataLocation } from '../shared/user_data_location';

export class CoderCredentials {
	private readonly file: string;
	constructor(directory = path.join(userDataLocation(), 'coder')) {
		mkdirSync(directory, { recursive: true });
		this.file = path.join(directory, 'credentials.json');
	}
	get(key: string): string | undefined {
		if (!existsSync(this.file)) return undefined;
		const values = JSON.parse(readFileSync(this.file, 'utf8')) as Record<string, string>;
		if (!values[key]) return undefined;
		if (!safeStorage.isEncryptionAvailable())
			throw new Error('Secure credential storage is unavailable.');
		return safeStorage.decryptString(Buffer.from(values[key], 'base64'));
	}
	set(key: string, value: string): void {
		if (!safeStorage.isEncryptionAvailable())
			throw new Error('Secure credential storage is unavailable.');
		if (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text')
			throw new Error('Enable a system keyring before saving API keys.');
		const values: Record<string, string> = existsSync(this.file)
			? JSON.parse(readFileSync(this.file, 'utf8'))
			: {};
		if (value.trim()) values[key] = safeStorage.encryptString(value.trim()).toString('base64');
		else delete values[key];
		writeFileSync(this.file + '.tmp', JSON.stringify(values), { mode: 0o600 });
		renameSync(this.file + '.tmp', this.file);
	}
}
