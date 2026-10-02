import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { getIdentity, updateIdentity } from '../../../../src/main/identity';
import { getIdentityTool } from '../../../../src/main/agent/tools/identity/get';
import { updateIdentityTool } from '../../../../src/main/agent/tools/identity/update';

it('stores structured identity only through updates and reads legacy identity without creating settings', async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), 'kucedr-identity-'));
	const previous = process.env.KUCEDR_E2E_DATA_ROOT;
	process.env.KUCEDR_E2E_DATA_ROOT = root;
	try {
		const target = path.join(root, 'identity', 'settings.json');
		expect(await getIdentityTool.run({})).toBeNull();
		await expect(readFile(target)).rejects.toMatchObject({ code: 'ENOENT' });
		await updateIdentity({ name: 'Kucedr', role: 'Assistant', vibe: 'Calm' });
		expect(await getIdentityTool.run({})).toEqual({ name: 'Kucedr', role: 'Assistant', vibe: 'Calm' });
		await updateIdentityTool.run({ name: 'Kucedr', role: 'Research assistant', avatar: 'avatar.png' });
		expect(await getIdentity()).toEqual({ name: 'Kucedr', role: 'Research assistant', avatar: 'avatar.png' });
		expect(JSON.parse(await readFile(target, 'utf8'))).toEqual({ name: 'Kucedr', role: 'Research assistant', avatar: 'avatar.png' });
		await expect(readFile(path.join(root, 'identity', 'IDENTITY.md'))).rejects.toMatchObject({ code: 'ENOENT' });
		await expect(updateIdentityTool.run({ name: '', role: 'Assistant' })).rejects.toThrow();
		await rm(target);
		expect(await getIdentity()).toBeNull();
		await expect(readFile(target)).rejects.toMatchObject({ code: 'ENOENT' });
		const previousIdentity = path.join(root, 'identity', 'IDENTITY.md');
		await writeFile(previousIdentity, '# IDENTITY.md - Assistant Identity\n\n- **Name:** Previous\n- **Role:** Guide');
		expect(await getIdentity()).toEqual({ name: 'Previous', role: 'Guide' });
		await expect(readFile(target)).rejects.toMatchObject({ code: 'ENOENT' });
		await rm(previousIdentity);
		await writeFile(path.join(root, 'IDENTITY.md'), '# IDENTITY.md - Assistant Identity\n\n- **Name:** Legacy\n- **Vibe:** Thoughtful\n\nAdditional context.');
		expect(await getIdentity(root)).toEqual({ name: 'Legacy', role: 'Assistant', vibe: 'Thoughtful', metadata: 'Additional context.' });
		await expect(readFile(target)).rejects.toMatchObject({ code: 'ENOENT' });
	} finally {
		process.env.KUCEDR_E2E_DATA_ROOT = previous;
		await rm(root, { recursive: true, force: true });
	}
});
