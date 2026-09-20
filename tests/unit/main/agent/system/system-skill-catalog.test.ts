import { buildSkillContext } from '../../../../../src/main/agent/system/system_build_skill_context';
import type { SkillInfo } from '../../../../../src/shared/skills_types';

describe('buildSkillContext', () => {
	it('uses stable ordering and never exceeds the catalog character budget', () => {
		const skills = Array.from(
			{ length: 20 },
			(_, index): SkillInfo => ({
				id: `skill-${String(index).padStart(2, '0')}`,
				name: `skill-${String(19 - index).padStart(2, '0')}`,
				description: 'd'.repeat(1_000),
				location: '/skills/x',
				folderPath: '/skills/x',
				manifest: { name: 'x', description: 'd'.repeat(1_000) },
				source: 'local-filesystem',
				trust: 'user-controlled',
				hash: String(index),
			})
		);
		const context = buildSkillContext(skills);
		expect(context.length).toBeLessThanOrEqual(8_000);
		for (let index = 0; index < 20; index += 1)
			expect(context).toContain(`skill-${String(index).padStart(2, '0')}`);
		expect(context).not.toContain('Additional skill names omitted');
		expect(context).toContain('…');
		expect(context.indexOf('skill-00')).toBeLessThan(context.indexOf('skill-01'));
	});
});
