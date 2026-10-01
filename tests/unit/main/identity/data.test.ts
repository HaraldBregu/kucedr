import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { getIdentity, updateIdentity } from '../../../../src/main/identity';
import { getIdentityTool } from '../../../../src/main/agent/tools/identity/get';
import { updateIdentityTool } from '../../../../src/main/agent/tools/identity/update';

it('creates identity only through update tools and leaves a missing identity absent', async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), 'kucedr-identity-'));
	const previous = process.env.KUCEDR_E2E_DATA_ROOT;
	process.env.KUCEDR_E2E_DATA_ROOT = root;
	try {
		const target = path.join(root, 'identity', 'IDENTITY.md');
		expect(await getIdentityTool.run({})).toBe('');
		await expect(readFile(target)).rejects.toMatchObject({ code: 'ENOENT' });
		await updateIdentity('# My identity');
		expect(await getIdentityTool.run({})).toBe('# My identity');
		await updateIdentityTool.run({ content: '# Updated identity' });
		expect(await getIdentity()).toBe('# Updated identity');
		await rm(target);
		expect(await getIdentity()).toBe('');
		await expect(readFile(target)).rejects.toMatchObject({ code: 'ENOENT' });
	} finally {
		process.env.KUCEDR_E2E_DATA_ROOT = previous;
		await rm(root, { recursive: true, force: true });
	}
});
