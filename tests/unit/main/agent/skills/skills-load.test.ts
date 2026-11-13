import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { inspectSkill } from '../../../../../src/main/agent/skills/skills_inspect';
import type { SkillInfo, SkillRegistrySnapshot } from '../../../../../src/shared/skills_types';

describe('inspectSkill', () => {
	it('returns exact instructions, canonical root, current hash, and contained resources', async () => {
		const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'kucedr-skill-load-'));
		const root = path.join(parent, 'writer');
		const source = '---\nname: writer\ndescription: Writes\nallowed-tools: read\n---\nExact body';
		try {
			fs.mkdirSync(path.join(root, 'references'), { recursive: true });
			fs.writeFileSync(path.join(root, 'SKILL.md'), source);
			fs.writeFileSync(path.join(root, 'references', 'guide.md'), 'guide');
			const info: SkillInfo = {
				id: 'writer',
				name: 'writer',
				description: 'Writes',
				folderPath: root,
				skillPath: path.join(root, 'SKILL.md'),
				manifest: { name: 'writer', description: 'Writes', allowedTools: ['read'] },
				source: 'user',
				trust: 'user-controlled',
				hash: createHash('sha256').update(source).digest('hex'),
			};
			const snapshot: SkillRegistrySnapshot = { skills: [info], invalid: [], diagnostics: [] };
			const loaded = await inspectSkill(snapshot, 'writer');
			expect(loaded).toEqual(
				expect.objectContaining({
					canonicalRoot: fs.realpathSync(root),
					instructions: 'Exact body',
					hash: info.hash,
					resources: ['references/guide.md'],
				})
			);
			fs.appendFileSync(path.join(root, 'SKILL.md'), '\nchanged');
			const changed = await inspectSkill(snapshot, 'writer');
			expect(changed.instructions).toBe('Exact body\nchanged');
			expect(changed.hash).not.toBe(info.hash);
		} finally {
			fs.rmSync(parent, { recursive: true, force: true });
		}
	});

	it('fails for unknown skills', async () => {
		await expect(
			inspectSkill({ skills: [], invalid: [], diagnostics: [] }, 'missing')
		).rejects.toThrow('not found');
	});
});
