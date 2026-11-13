import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { readSkill } from '../../../../../src/main/agent/skills/skills_read';

describe('readSkill', () => {
	it('records the validated local source, trust, and exact content hash', () => {
		const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'kucedr-skill-'));
		const folder = path.join(parent, 'safe-skill');
		const source = '---\nname: safe-skill\ndescription: Safe\nallowed-tools: read write\n---\nBody';
		try {
			fs.mkdirSync(folder);
			fs.writeFileSync(path.join(folder, 'SKILL.md'), source);
			const skill = readSkill(folder, 'safe-skill');
			expect(skill).toEqual(
				expect.objectContaining({
					source: 'user',
					trust: 'user-controlled',
					hash: createHash('sha256').update(source).digest('hex'),
				})
			);
			expect(skill?.manifest.allowedTools).toEqual(['read', 'write']);
		} finally {
			fs.rmSync(parent, { recursive: true, force: true });
		}
	});
});
