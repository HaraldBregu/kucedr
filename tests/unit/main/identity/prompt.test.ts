import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { buildWorkspaceContext } from '../../../../src/main/agent/system/system_build_workspace_context';
import { workspacePath } from '../../../../src/main/agent/system/system_workspace_path';
import { updateSoul } from '../../../../src/main/soul';
import { updateIdentity } from '../../../../src/main/identity';
import { updateUser } from '../../../../src/main/user';
import { completeBootstrapTool } from '../../../../src/main/agent/tools/assistant/complete_bootstrap';

it('regenerates AGENTS.md from modules without feeding its previous content back in', async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), 'kucedr-generated-prompt-'));
	const previous = process.env.KUCEDR_E2E_DATA_ROOT;
	process.env.KUCEDR_E2E_DATA_ROOT = root;
	try {
		const config = { location: path.join(root, 'workspace') };
		workspacePath(config);
		const file = path.join(config.location, 'AGENTS.md');
		await writeFile(file, 'Obsolete generated content');
		const first = await buildWorkspaceContext(config, 'full', 'Remembered preference');
		await expect(readFile(file)).rejects.toMatchObject({ code: 'ENOENT' });
		for (const name of ['SOUL', 'USER', 'IDENTITY']) {
			expect(first).toContain(name + '.md');
		}
		expect(first).not.toContain('Remembered preference');
		await updateSoul('Updated soul instructions');
		const partial = await buildWorkspaceContext(config);
		expect(partial).toContain('IDENTITY.md, USER.md');
		await expect(readFile(file)).rejects.toMatchObject({ code: 'ENOENT' });
		await expect(completeBootstrapTool.run({})).rejects.toThrow('IDENTITY.md, USER.md');
		expect(await readFile(path.join(config.location, 'BOOTSTRAP.md'), 'utf8')).toContain('First Run');
		await updateIdentity('# IDENTITY.md - Assistant Identity\n\n- **Name:** Kucedr');
		await updateUser('# USER.md - User Profile\n\n- **Name:** Alice');
		const complete = await buildWorkspaceContext(config, 'full', 'Remembered preference');
		expect(await readFile(file, 'utf8')).toBe(complete);
		for (const name of ['SOUL', 'HEALTH', 'BOOTSTRAP', 'MEMORY']) {
			expect(complete).toContain(`### ${name}.md`);
		}
		expect(complete).toContain('### IDENTITY\nUse `update_identity` to change the assistant\'s name, avatar, or identity.\n- **Name:** Kucedr');
		expect(complete).not.toContain('IDENTITY.md');
		expect(complete).toContain('### User profile\nUse `update_user` to change the user\'s name or preferences.\n- **Name:** Alice');
		expect(complete).not.toContain('USER.md');
		expect(complete).not.toContain('Obsolete generated content');
		await completeBootstrapTool.run({});
		const next = await buildWorkspaceContext(config, 'full');
		expect(next).toContain('Updated soul instructions');
		expect(next).not.toContain('### BOOTSTRAP.md');
		expect(next).not.toContain('Remembered preference');
		const core = await buildWorkspaceContext(config, 'core', 'Private memory');
		expect(core).not.toContain('### User profile');
		expect(core).not.toContain('Private memory');
		expect(await readFile(file, 'utf8')).toBe(next);
	} finally {
		if (previous === undefined) delete process.env.KUCEDR_E2E_DATA_ROOT;
		else process.env.KUCEDR_E2E_DATA_ROOT = previous;
		await rm(root, { recursive: true, force: true });
	}
});
