import { parseSkillCommand } from '../../../../../src/main/agent/skills/skills_parse_command';

describe('parseSkillCommand', () => {
	it('extracts explicit skill selection without filesystem routing', () => {
		expect(parseSkillCommand('/skill writer Draft this')).toEqual({
			message: 'Draft this',
			explicitSkill: 'writer',
		});
		expect(parseSkillCommand('/skill writer')).toEqual({
			message: 'Use the explicitly selected skill.',
			explicitSkill: 'writer',
		});
		expect(parseSkillCommand('ordinary prompt')).toEqual({ message: 'ordinary prompt' });
	});
	it('parses /skill off as an unload request', () => {
		expect(parseSkillCommand('/skill off writer')).toEqual({
			message: 'Stop using the "writer" skill.',
			unloadSkill: 'writer',
		});
		expect(parseSkillCommand('/skill off writer now summarize')).toEqual({
			message: 'now summarize',
			unloadSkill: 'writer',
		});
	});
});
