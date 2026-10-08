import { z } from 'zod';
import type { SkillRegistrySnapshot } from '../../../../shared/skills_types';
import type { Tool } from '../../types';
import { tool } from '../tool';

export function listSkillsTool(snapshot: SkillRegistrySnapshot): Tool {
	const skills = snapshot.skills.map(({ name, description }) => ({ name, description }));

	return tool({
		id: 'list_skills',
		category: 'skill',
		name: 'List skills',
		description:
			'List the available Agent Skills with their names and descriptions. Use only when the user explicitly asks to list or inspect skills.',
		planSafe: true,
		inputSchema: z.object({}).strict(),
		execute: () => ({ skills }),
	});
}
