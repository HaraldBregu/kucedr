import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { safeStorage } from 'electron';
import { CoderCredentials } from '../../../../src/main/coding/credentials';

it('keeps keys scoped to their harness and removes only the selected credential', () => {
	const directory = path.join(mkdtempSync(path.join(tmpdir(), 'coder-credentials-')), 'coder');
	const credentials = new CoderCredentials(directory);
	credentials.set('openai', 'pi-key', 'pi');
	credentials.set('openai', 'codex-key', 'codex');
	credentials.set('anthropic', 'claude-key', 'claude');
	expect(credentials.get('openai', 'pi')).toBe('pi-key');
	expect(credentials.get('openai', 'codex')).toBe('codex-key');
	credentials.set('openai', '', 'codex');
	expect(credentials.get('openai', 'codex')).toBeUndefined();
	expect(credentials.get('openai', 'pi')).toBe('pi-key');
	expect(credentials.get('anthropic', 'claude')).toBe('claude-key');
	expect(safeStorage.encryptString).toHaveBeenCalledWith('claude-key');
	expect(
		Object.keys(JSON.parse(readFileSync(path.join(directory, 'credentials.json'), 'utf8')))
	).toEqual(['pi:openai', 'claude:anthropic']);
});
