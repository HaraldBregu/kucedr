const list = jest.fn();

jest.mock('../../../../../src/main/agent/skills/skills_list', () => ({ list }));

import { resolveSkillFolder } from '../../../../../src/main/agent/skills/skills_resolve_folder';

describe('resolveSkillFolder', () => {
	it('returns the folder of the entry Settings lists for that id', () => {
		list.mockReturnValue([{ id: 'writer', folderPath: '/plugins/docs/skills/writer' }]);
		expect(resolveSkillFolder('writer')).toBe('/plugins/docs/skills/writer');
	});
	it('rejects ids that are not listed, including path tricks', () => {
		list.mockReturnValue([{ id: 'writer', folderPath: '/skills/writer' }]);
		expect(() => resolveSkillFolder('missing')).toThrow(/not found/);
		expect(() => resolveSkillFolder('../writer')).toThrow(/not found/);
		expect(() => resolveSkillFolder('..')).toThrow(/not found/);
	});
});
