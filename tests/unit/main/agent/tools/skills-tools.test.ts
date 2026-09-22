import { listSkillsTool } from '../../../../../src/main/agent/tools/skills/list_skills';
import type {
	SkillInfo,
	SkillRegistrySnapshot,
} from '../../../../../src/shared/skills_types';

function skill(name: string, overrides: Partial<SkillInfo> = {}): SkillInfo {
	return {
		id: name,
		name,
		description: `${name} description`,
		location: `/skills/${name}`,
		folderPath: `/skills/${name}`,
		manifest: { name, description: `${name} description` },
		source: 'local-filesystem',
		trust: 'user-controlled',
		hash: `${name}-hash`,
		...overrides,
	};
}

it('returns the names and descriptions of available skills', async () => {
	const snapshot: SkillRegistrySnapshot = {
		skills: [skill('writer'), skill('researcher')],
		diagnostics: [],
	};
	const listSkills = listSkillsTool(snapshot);

	expect(listSkills).toMatchObject({
		id: 'list_skills',
		name: 'List skills',
		description: 'List the available Agent Skills with their names and descriptions.',
	});
	expect(() => listSkills.parseInput({ unexpected: true })).toThrow();
	await expect(listSkills.run(listSkills.parseInput({}))).resolves.toEqual({
		skills: [
			{ name: 'writer', description: 'writer description' },
			{ name: 'researcher', description: 'researcher description' },
		],
	});
});
