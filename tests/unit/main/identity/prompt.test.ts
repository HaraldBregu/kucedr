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
		expect(first).toContain('Missing profile content: identity, soul, user');
		expect(first).not.toContain('Remembered preference');
		await updateSoul('# SOUL.md - Persona\n\nUpdated soul instructions');
		const partial = await buildWorkspaceContext(config);
		expect(partial).toContain('Missing profile content: identity, user');
		await expect(readFile(file)).rejects.toMatchObject({ code: 'ENOENT' });
		await expect(completeBootstrapTool.run({})).rejects.toThrow('Complete identity, user');
		const bootstrap = await readFile(path.join(config.location, 'BOOTSTRAP.md'), 'utf8');
		expect(bootstrap).toContain('First Run');
		expect(bootstrap).toContain('Assistant soul - tone, boundaries, and interaction style; save with `update_soul`');
		expect(bootstrap).toContain('## Tools available during bootstrap');
		expect(bootstrap).toContain('`complete_bootstrap` - finish setup after all three profiles have content.');
		expect(bootstrap).not.toContain('SOUL.md');
		await updateIdentity('# IDENTITY.md - Assistant Identity\n\n- **Name:** Kucedr');
		await updateUser('# USER.md - User Profile\n\n- **Name:** Alice');
		const complete = await buildWorkspaceContext(config, 'full', 'Remembered preference');
		expect(await readFile(file, 'utf8')).toBe(complete);
		expect(complete).toContain('### Files\n- `read`\n- `write`\n- `edit`\n- `patch`\n- `undo`\n- `redo`');
		expect(complete).toContain('### Profiles\n- `update_identity`\n- `update_soul`\n- `update_user`');
		expect(complete).toContain('### Bootstrap\n- `complete_bootstrap`');
		expect(complete).toContain('### Discovery\n- `tool_search`');
		for (const name of ['BOOTSTRAP', 'MEMORY']) {
			expect(complete).toContain(`### ${name}.md`);
		}
		expect(complete).not.toContain('HEALTH.md');
		expect(complete).not.toContain('Health checklists');
		expect(complete).toContain('### SOUL\nUse `update_soul` to change the assistant\'s tone, boundaries, or interaction style.\nUpdated soul instructions');
		expect(complete).not.toContain('SOUL.md');
		expect(complete).toContain('### IDENTITY\nUse `update_identity` to change the assistant\'s name, avatar, or identity.\n- **Name:** Kucedr');
		expect(complete).not.toContain('IDENTITY.md');
		expect(complete).toContain('### User profile\nUse `update_user` to change the user\'s name or preferences.\n- **Name:** Alice');
		expect(complete).not.toContain('USER.md');
		expect(complete).not.toContain('Obsolete generated content');
		const voice = await buildWorkspaceContext(config, 'full', '', 'voice');
		expect(voice).toContain('### SOUL');
		expect(voice).not.toContain('## Tools loaded by default in ordinary text chat');
		expect(await readFile(file, 'utf8')).toContain('## Tools loaded by default in ordinary text chat');
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
