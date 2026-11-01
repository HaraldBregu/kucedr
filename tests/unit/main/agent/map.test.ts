import { mapTool } from '../../../../src/main/agent/tools/web/map';
import { isAgentToolAllowedForProfile } from '../../../../src/shared/agent_tools';

describe('show_map', () => {
	it('returns validated map data for chat rendering', async () => {
		const input = {
			latitude: 41.9,
			longitude: 12.5,
			zoom: 12,
			markers: [{ latitude: 41.9, longitude: 12.5, label: 'Rome' }],
		};
		expect(JSON.parse(await mapTool.run(input))).toEqual(input);
	});

	it('rejects invalid coordinates and zoom', () => {
		expect(() => mapTool.parseInput({ latitude: 91, longitude: 0 })).toThrow();
		expect(() => mapTool.parseInput({ latitude: 0, longitude: 181 })).toThrow();
		expect(() => mapTool.parseInput({ latitude: 0, longitude: 0, zoom: 20 })).toThrow();
	});

	it('is available only in the chat profile', () => {
		const tool = { kind: 'builtin' as const, id: 'show_map' };
		expect(isAgentToolAllowedForProfile('chat', tool)).toBe(true);
		expect(isAgentToolAllowedForProfile('tasks', tool)).toBe(false);
	});
});
