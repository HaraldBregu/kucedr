import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { safeStorage } from 'electron';
import { CoderCredentials } from '../../../../src/main/coding/credentials';

it('keeps keys scoped to their harness and removes only the selected credential', () => {
	const directory = path.join(mkdtempSync(path.join(tmpdir(), 'coder-credentials-')), 'coder');
	const credentials = new CoderCredentials(directory);
	credentials.set('pi:openai', 'pi-key');
	credentials.set('codex:openai', 'codex-key');
	credentials.set('pi:anthropic', 'pi-anthropic-key');
	credentials.set('cline:cline', 'cline-key');
	expect(credentials.get('pi:openai')).toBe('pi-key');
	expect(credentials.get('codex:openai')).toBe('codex-key');
	credentials.set('codex:openai', '');
	expect(credentials.get('codex:openai')).toBeUndefined();
	expect(credentials.get('pi:openai')).toBe('pi-key');
	expect(credentials.get('pi:anthropic')).toBe('pi-anthropic-key');
	expect(credentials.get('cline:cline')).toBe('cline-key');
	expect(safeStorage.encryptString).toHaveBeenCalledWith('pi-anthropic-key');
	expect(
		Object.keys(JSON.parse(readFileSync(path.join(directory, 'credentials.json'), 'utf8')))
	).toEqual(['pi:openai', 'pi:anthropic', 'cline:cline']);
});
