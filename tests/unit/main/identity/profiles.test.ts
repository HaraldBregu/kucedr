import { mkdtemp, readFile, rm } from 'node:fs/promises';
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
		for (const [name, get, update] of [
			['soul', getSoulTool, updateSoulTool],
			['user', getUserTool, updateUserTool],
		] as const) {
			const target = path.join(root, name, `${name.toUpperCase()}.md`);
			expect(await get.run({})).toBe('');
			await expect(readFile(target)).rejects.toMatchObject({ code: 'ENOENT' });
			await update.run({ content: `# Updated ${name}` });
			expect(await get.run({})).toBe(`# Updated ${name}`);
			await rm(target);
			expect(await get.run({})).toBe('');
			await expect(readFile(target)).rejects.toMatchObject({ code: 'ENOENT' });
			await expect(
				readFile(path.join(workspace, `${name.toUpperCase()}.md`))
			).rejects.toMatchObject({ code: 'ENOENT' });
		}
		await rm(bootstrap);
		await update.run({ content: '# User' });
		workspacePath({ location: workspace });
		await expect(readFile(bootstrap)).rejects.toMatchObject({ code: 'ENOENT' });
	} finally {
		if (previous === undefined) delete process.env.KUCEDR_E2E_DATA_ROOT;
		else process.env.KUCEDR_E2E_DATA_ROOT = previous;
		await rm(root, { recursive: true, force: true });
	}
});
