import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { getSoulTool } from '../../../../src/main/agent/tools/soul/get';
import { updateSoulTool } from '../../../../src/main/agent/tools/soul/update';
import { getUserTool } from '../../../../src/main/agent/tools/user/get';
import { updateUserTool } from '../../../../src/main/agent/tools/user/update';
import { workspacePath } from '../../../../src/main/agent/system/system_workspace_path';

it('creates soul and user profiles only through update tools', async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), 'kucedr-profiles-'));
	const previous = process.env.KUCEDR_E2E_DATA_ROOT;
	process.env.KUCEDR_E2E_DATA_ROOT = root;
	try {
		const workspace = workspacePath({ location: path.join(root, 'workspace') });
		const bootstrap = path.join(workspace, 'BOOTSTRAP.md');
		for (const [name, get, update, settings] of [
			['soul', getSoulTool, updateSoulTool, { tone: 'Calm', boundaries: 'Respect privacy' }],
			['user', getUserTool, updateUserTool, { name: 'Alice', timezone: 'Europe/Rome' }],
		] as const) {
			const target = path.join(root, name, 'settings.json');
			expect(await get.run({})).toBeNull();
			await expect(readFile(target)).rejects.toMatchObject({ code: 'ENOENT' });
			await update.run(settings);
			expect(await get.run({})).toEqual(settings);
			expect(JSON.parse(await readFile(target, 'utf8'))).toEqual(settings);
			await expect(readFile(path.join(root, name, `${name.toUpperCase()}.md`))).rejects.toMatchObject({ code: 'ENOENT' });
			await rm(target);
			expect(await get.run({})).toBeNull();
			await expect(readFile(target)).rejects.toMatchObject({ code: 'ENOENT' });
			await expect(
				readFile(path.join(workspace, `${name.toUpperCase()}.md`))
			).rejects.toMatchObject({ code: 'ENOENT' });
		}
		await expect(updateSoulTool.run({ tone: '' })).rejects.toThrow();
		await expect(updateUserTool.run({ name: '' })).rejects.toThrow();
		const legacySoul = path.join(root, 'soul', 'SOUL.md');
		const legacyUser = path.join(root, 'user', 'USER.md');
		await writeFile(legacySoul, '# SOUL.md - Persona\n\nBe concise.');
		await writeFile(legacyUser, '# USER.md - User Profile\n\n- **Name:** Alice\n- **What to call them:** Al\n\nRemember this.');
		expect(await getSoulTool.run({})).toEqual({ tone: 'Be concise.' });
		expect(await getUserTool.run({})).toEqual({ name: 'Alice', preferredName: 'Al', notes: 'Remember this.' });
		await expect(readFile(path.join(root, 'soul', 'settings.json'))).rejects.toMatchObject({ code: 'ENOENT' });
		await expect(readFile(path.join(root, 'user', 'settings.json'))).rejects.toMatchObject({ code: 'ENOENT' });
		await rm(legacySoul);
		await rm(legacyUser);
		await rm(bootstrap);
		await updateUserTool.run({ name: 'Alice' });
		workspacePath({ location: workspace });
		await expect(readFile(bootstrap)).rejects.toMatchObject({ code: 'ENOENT' });
	} finally {
		if (previous === undefined) delete process.env.KUCEDR_E2E_DATA_ROOT;
		else process.env.KUCEDR_E2E_DATA_ROOT = previous;
		await rm(root, { recursive: true, force: true });
	}
});
