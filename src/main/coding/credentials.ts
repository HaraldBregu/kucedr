import { safeStorage } from 'electron';
import { mkdirSync, existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import path from 'node:path';
import type { CoderHarness } from '../../shared/coding_types';
import { userDataLocation } from '../shared/user_data_location';

export class CoderCredentials {
	private readonly file: string;
	constructor(directory = path.join(userDataLocation(), 'coder')) {
		mkdirSync(directory, { recursive: true });
		this.file = path.join(directory, 'credentials.json');
	}
	get(provider: 'openai' | 'anthropic', runtime: CoderHarness = 'pi'): string | undefined {
		if (!existsSync(this.file)) return undefined;
		const values = JSON.parse(readFileSync(this.file, 'utf8')) as Record<string, string>;
		if (!values[`${runtime}:${provider}`]) return undefined;
		if (!safeStorage.isEncryptionAvailable())
			throw new Error('Secure credential storage is unavailable.');
		return safeStorage.decryptString(Buffer.from(values[`${runtime}:${provider}`], 'base64'));
	}
	set(provider: 'openai' | 'anthropic', value: string, runtime: CoderHarness = 'pi'): void {
		if (!safeStorage.isEncryptionAvailable())
			throw new Error('Secure credential storage is unavailable.');
		if (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text')
			throw new Error('Enable a system keyring before saving API keys.');
		const values: Record<string, string> = existsSync(this.file)
			? JSON.parse(readFileSync(this.file, 'utf8'))
			: {};
		if (value.trim())
			values[`${runtime}:${provider}`] = safeStorage.encryptString(value.trim()).toString('base64');
		else delete values[`${runtime}:${provider}`];
		writeFileSync(this.file + '.tmp', JSON.stringify(values), { mode: 0o600 });
		renameSync(this.file + '.tmp', this.file);
	}
}
