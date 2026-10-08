import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { buildWorkspaceContext } from '../../../../src/main/agent/system/system_build_workspace_context';
import { workspacePath } from '../../../../src/main/agent/system/system_workspace_path';
import { updateSoul } from '../../../../src/main/soul';
import { updateIdentity } from '../../../../src/main/identity';
import { updateUser } from '../../../../src/main/user';
import { completeBootstrapTool } from '../../../../src/main/agent/tools/assistant/complete_bootstrap';

it('composes agent context from runtime modules and tools without using AGENTS.md', async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), 'kucedr-generated-prompt-'));
	const previous = process.env.KUCEDR_E2E_DATA_ROOT;
	process.env.KUCEDR_E2E_DATA_ROOT = root;
	try {
		const config = { location: path.join(root, 'workspace') };
		workspacePath(config);
		const file = path.join(config.location, 'AGENTS.md');
		await writeFile(file, 'Static instructions must not be used');
		const first = await buildWorkspaceContext(config, 'full', 'Remembered preference');
		expect(await readFile(file, 'utf8')).toBe('Static instructions must not be used');
		expect(first).toContain('Missing profile content: identity, soul, user');
		expect(first).not.toContain('Remembered preference');
		await updateSoul({ tone: 'Calm and direct', boundaries: 'Respect privacy' });
		const partial = await buildWorkspaceContext(config);
		expect(partial).toContain('Missing profile content: identity, user');
		expect(await readFile(file, 'utf8')).toBe('Static instructions must not be used');
		await expect(completeBootstrapTool.run({})).rejects.toThrow('Complete identity, user');
		const bootstrap = await readFile(path.join(config.location, 'BOOTSTRAP.md'), 'utf8');
		expect(bootstrap).toContain('First Run');
		expect(bootstrap).toContain(
			'Assistant soul - tone, boundaries, and interaction style; save with `update_soul`'
		);
		expect(bootstrap).toContain('## Tools available during bootstrap');
		expect(bootstrap).toContain(
			'`complete_bootstrap` - finish setup after all three profiles have content.'
		);
		expect(bootstrap).not.toContain('SOUL.md');
		await updateIdentity({ name: 'Kucedr', role: 'Assistant', vibe: 'Calm' });
		await updateUser({
			name: 'Alice',
			preferredName: 'Al',
			timezone: 'Europe/Rome',
			projects: 'A personal history book Alice chose to share.',
		});
		const complete = await buildWorkspaceContext(config, 'full', 'Remembered preference');
		expect(complete).not.toContain('## Tools available in this runtime');
		expect(complete).toContain('### BOOTSTRAP.md');
		expect(complete).toContain('### MEMORY\nUse memory as durable background context');
		expect(complete).not.toContain('### MEMORY.md');
		expect(complete).not.toContain('HEALTH.md');
		expect(complete).not.toContain('Health checklists');
		expect(complete).toContain(
			'### SOUL\n- **Tone:** Calm and direct\n- **Boundaries:** Respect privacy'
		);
		expect(complete).not.toContain('SOUL.md');
		expect(complete).toContain(
			'### IDENTITY\n- **Name:** Kucedr\n- **Role:** Assistant\n- **Vibe:** Calm'
		);
		expect(complete).not.toContain('IDENTITY.md');
		expect(complete).toContain(
			"### USER\nAdd projects only when the user chooses to describe them for this profile; do not derive them from workspace files or folders.\n- **Name:** Alice\n- **What to call them:** Al\n- **Timezone:** Europe/Rome\n- **Projects:** A personal history book Alice chose to share."
		);
		expect(complete).not.toContain('USER.md');
		expect(complete).not.toContain('Obsolete generated content');
		const emptyMemory = await buildWorkspaceContext(config, 'full');
		expect(emptyMemory).not.toContain('### MEMORY');
		const headerOnlyMemory = await buildWorkspaceContext(config, 'full', '# Memory\n\n');
		expect(headerOnlyMemory).not.toContain('### MEMORY');
		const voice = await buildWorkspaceContext(config, 'full');
		expect(voice).toContain('### SOUL');
		expect(voice).not.toContain('## Tools available in this runtime');
		await completeBootstrapTool.run({});
		const next = await buildWorkspaceContext(config, 'full');
		expect(next).toContain('Calm and direct');
		expect(next).not.toContain('### BOOTSTRAP.md');
		expect(next).not.toContain('Remembered preference');
		const core = await buildWorkspaceContext(config, 'core', 'Private memory');
		expect(core).not.toContain('### USER');
		expect(core).not.toContain('Private memory');
		const other = await buildWorkspaceContext(config, 'core');
		expect(other).not.toContain('## Tools available in this runtime');
		expect(await readFile(file, 'utf8')).toBe('Static instructions must not be used');
		await updateIdentity({ name: 'Nova', role: 'Planner' });
		const renamed = await buildWorkspaceContext(config, 'full');
		expect(renamed).toContain('- **Name:** Nova\n- **Role:** Planner');
		expect(renamed).not.toContain('- **Name:** Kucedr');
		expect(await readFile(file, 'utf8')).toBe('Static instructions must not be used');
		await updateSoul({ tone: 'Warm', interactionStyle: 'Answer briefly' });
		await updateUser({ name: 'Alice', preferredName: 'Allie' });
		const revised = await buildWorkspaceContext(config, 'full');
		expect(revised).toContain('- **Tone:** Warm\n- **Interaction style:** Answer briefly');
		expect(revised).toContain('- **Name:** Alice\n- **What to call them:** Allie');
		expect(revised).not.toContain('Calm and direct');
		expect(revised).not.toContain('Europe/Rome');
		expect(revised).not.toContain('A personal history book');
		expect(await readFile(file, 'utf8')).toBe('Static instructions must not be used');
		await updateIdentity({
			name: 'Alfred',
			role: "Harald's personal butler and assistant",
			vibe: 'Composed and precise',
			metadata:
				'Use update_identity to change the assistant\'s name, role, avatar, or identity.\n\n# Alfred\n\n**Name:** Alfred\n**Also addressed as:** "Sir Alfred"\n\n**Role:** Harald\'s butler and personal assistant\n\n**Vibe:** Composed and precise',
		});
		const deduplicated = await buildWorkspaceContext(config, 'full');
		const identitySection = deduplicated.split('### IDENTITY\n')[1].split('\n\n### SOUL')[0];
		expect(identitySection.match(/\*\*Name:\*\*/g)).toHaveLength(1);
		expect(identitySection.match(/\*\*Role:\*\*/g)).toHaveLength(1);
		expect(identitySection.match(/\*\*Vibe:\*\*/g)).toHaveLength(1);
		expect(identitySection).toContain('**Also addressed as:** "Sir Alfred"');
		expect(identitySection).not.toContain('Use update_identity to change the assistant');
		expect(identitySection).not.toContain('# Alfred');
		expect(identitySection).not.toContain('**Metadata:**');
		expect(await readFile(file, 'utf8')).toBe('Static instructions must not be used');
	} finally {
		if (previous === undefined) delete process.env.KUCEDR_E2E_DATA_ROOT;
		else process.env.KUCEDR_E2E_DATA_ROOT = previous;
		await rm(root, { recursive: true, force: true });
	}
});
