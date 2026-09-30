import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { getIdentity, updateIdentity } from '../../../../src/main/identity';
import { getIdentityTool } from '../../../../src/main/agent/tools/identity/get';
import { updateIdentityTool } from '../../../../src/main/agent/tools/identity/update';

it('creates, updates, reads through tools, and recreates a missing identity', async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), 'kucedr-identity-'));
	const previous = process.env.KUCEDR_E2E_DATA_ROOT;
	process.env.KUCEDR_E2E_DATA_ROOT = root;
	try {
		await updateIdentity('# My identity');
		expect(await getIdentityTool.run({})).toBe('# My identity');
		await updateIdentityTool.run({ content: '# Updated identity' });
		expect(await getIdentity()).toBe('# Updated identity');
		const target = path.join(root, 'identity', 'IDENTITY.md');
		await rm(target);
		const template = await readFile(path.resolve('resources/templates/IDENTITY.md'), 'utf8');
		expect(await getIdentity()).toBe(template);
		expect(await readFile(target, 'utf8')).toBe(template);
	} finally {
		process.env.KUCEDR_E2E_DATA_ROOT = previous;
		await rm(root, { recursive: true, force: true });
	}
});
