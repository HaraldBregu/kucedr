import type { Tool } from '../../../../../src/main/agent/types';
import { selectSkillTools } from '../../../../../src/main/agent/runner/run_skill_tools';
import { isAgentToolAllowedForProfile } from '../../../../../src/shared/agent_tools';

function fakeTool(name: string): Tool {
	return {
		id: name,
		name,
		description: name,
		schema: { type: 'object' },
		timeoutMs: 1_000,
		maxOutputBytes: 1_000,
		parseInput: () => ({}),
		run: () => undefined,
	};
}

describe('selectSkillTools', () => {
	it('intersects runtime tools with declared capabilities', () => {
		const tools = [
			fakeTool('read'),
			fakeTool('write'),
			fakeTool('subagent'),
			fakeTool('subagents'),
		];
		expect(
			selectSkillTools([...tools, fakeTool('load_skill')], ['read', 'subagent', 'subagents']).map(
				(tool) => tool.name
			)
		).toEqual(['read', 'load_skill']);
	});

	it('keeps backward-compatible tools when no capability list is declared', () => {
		const tools = [fakeTool('read')];
		expect(selectSkillTools(tools, undefined)).toBe(tools);
	});

	it('does not expand obsolete recorder capability names', () => {
		const recorder = fakeTool('microphone_recorder_status');
		expect(selectSkillTools([recorder], ['recorder_microphone_status'])).toEqual([]);
	});

	it('composes multiple restrictions without expanding the current runtime set', () => {
		const tools = [fakeTool('read'), fakeTool('write'), fakeTool('exec'), fakeTool('load_skill')];
		const first = selectSkillTools(tools, ['read', 'write']);
		const second = selectSkillTools(first, ['read', 'exec']);
		expect(second.map((tool) => tool.name)).toEqual(['read', 'load_skill']);
	});
});

describe('agent tool profiles', () => {
	it('limits Health to file and command tools', () => {
		expect(isAgentToolAllowedForProfile('health', { kind: 'builtin', id: 'read' })).toBe(true);
		expect(isAgentToolAllowedForProfile('health', { kind: 'builtin', id: 'bash' })).toBe(true);
		expect(isAgentToolAllowedForProfile('health', { kind: 'builtin', id: 'search_web' })).toBe(
			false
		);
		expect(
			isAgentToolAllowedForProfile('health', {
				kind: 'mcp',
				serverId: 'gmail',
				toolName: 'list_messages',
			})
		).toBe(false);
	});

	it.each([
		['chat', true, true],
		['voice', false, true],
		['tasks', false, false],
		['health', false, false],
		['channels', false, false],
	] as const)(
		'applies required system tool eligibility to %s',
		(profileId, allowsAsk, allowsBootstrap) => {
			expect(isAgentToolAllowedForProfile(profileId, { kind: 'builtin', id: 'ask' })).toBe(
				allowsAsk
			);
			expect(
				isAgentToolAllowedForProfile(profileId, { kind: 'builtin', id: 'complete_bootstrap' })
			).toBe(allowsBootstrap);
		}
	);
});
