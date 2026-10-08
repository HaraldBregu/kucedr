import { addBasePrompt } from '../../../../../src/main/agent/system/system_add_base_prompt';
import { addSkillPrompt } from '../../../../../src/main/agent/system/system_add_skill_prompt';
import { addToolsPrompt } from '../../../../../src/main/agent/system/system_add_tools_prompt';
import { buildSystemPrompt } from '../../../../../src/main/agent/system/system_build_prompt';
import type { Tool } from '../../../../../src/main/agent/types';

function tool(name: string, description?: string): Tool {
	return { id: name, category: 'system', name, description } as Tool;
}

describe('addBasePrompt', () => {
	it('appends the assistant identity and standard sections', () => {
		const prompt = addBasePrompt('');
		expect(prompt).toContain('You are a personal AI assistant.');
		expect(prompt).toContain('## Core instructions');
		expect(prompt).toContain('explicitly names a tool, service, access method, or action');
		expect(prompt).toContain('Do not ask for permission again in chat');
		expect(prompt).toContain('use the matching Tasks tools');
		expect(prompt).toContain('Use list_tasks first when task ids are not already known');
		expect(prompt).toContain('## Current UTC date and time');
		expect(prompt).toContain('## Voice');
		expect(prompt).toContain('## Workspace contract');
		expect(prompt).toContain('## Agent acceptance contract');
		expect(prompt.indexOf('## Core instructions')).toBeLessThan(
			prompt.indexOf('## Current UTC date and time')
		);
		expect(prompt.indexOf('## Core instructions')).toBeLessThan(prompt.indexOf('## Voice'));
	});
	it('directs the assistant to retain durable user context automatically', () => {
		const prompt = addBasePrompt('');
		expect(prompt).toContain('captured, recalled, corrected, pruned, and maintained automatically');
		expect(prompt).toContain('No memory tools exist');
		expect(prompt).toContain('process the request in the background');
		expect(prompt).toContain('Do not claim that deletion already completed');
		expect(prompt).not.toContain('forget_memory');
	});
	it('directs the assistant to use every recorder for matching user requests', () => {
		const prompt = addBasePrompt('');
		expect(prompt).toContain('call microphone_recorder');
		expect(prompt).toContain('call camera_recorder');
		expect(prompt).toContain('call screen_recorder');
	});
	it('grounds follow-ups in conversation history and keeps connected-service routing focused', () => {
		const prompt = addBasePrompt('');
		expect(prompt).toContain('Use the entire available history');
		expect(prompt).toContain('Do not ask for the same confirmation twice');
		expect(prompt).toContain('"can you" followed by a concrete action as a request to perform');
		expect(prompt).toContain('authorizes use of the relevant service tools');
		expect(prompt).toContain('use tool_search for that service and action');
		expect(prompt).toContain('Never substitute workspace files');
		expect(prompt).toContain('Do not delegate a simple follow-up');
		expect(prompt).toContain('Never claim that an action succeeded unless');
	});
	it('adds the current UTC time when the prompt is built', () => {
		const now = new Date('2026-10-08T13:45:12.345Z');
		const prompt = addBasePrompt('', now);
		expect(prompt).toContain('## Current UTC date and time');
		expect(prompt).toContain('- 2026-10-08T13:45:12.345Z');
		expect(prompt).toContain('in the timezone from the USER profile');
		expect(prompt).toContain('If the USER profile has no timezone, use UTC');
		expect(prompt).not.toContain('Local:');
		expect(prompt).not.toContain('Time zone:');
	});
	it('appends to any existing prompt', () => {
		expect(addBasePrompt('PRE')).toMatch(/^PRE/);
	});
});

describe('addToolsPrompt', () => {
	it('returns the prompt unchanged when there are no tools', () => {
		expect(addToolsPrompt('base', [])).toBe('base');
	});
	it('groups tools by category and includes each category description', () => {
		const prompt = addToolsPrompt('base', [tool('read', 'Read a file'), tool('write')]);
		expect(prompt).toContain('## Tools');
		expect(prompt).toContain(
			'### System\nAsk the user for required input and work with local device capabilities such as the microphone, camera, and screen.'
		);
		expect(prompt).toContain('- `read` (read) — Read a file _(Loaded.)_');
		expect(prompt).toContain('- `write` (write) _(Loaded.)_');
	});
	it('flattens newlines in descriptions', () => {
		const prompt = addToolsPrompt('base', [tool('x', 'line1\nline2')]);
		expect(prompt).toContain('- `x` (x) — line1 line2');
	});
	it('includes loaded native and MCP tools', () => {
		const prompt = addToolsPrompt('base', [
			tool('read', 'Read a file'),
			tool('mcp__notion__notion-search', 'Search Notion'),
		]);
		expect(prompt).toContain('- `read` (read) — Read a file _(Loaded.)_');
		expect(prompt).toContain(
			'- `mcp__notion__notion-search` (mcp__notion__notion-search) — Search Notion _(Loaded.)_'
		);
	});
	it('adds the tools section when only MCP tools are loaded', () => {
		const prompt = addToolsPrompt('base', [tool('mcp__notion__notion-search')]);
		expect(prompt).toContain('## Tools');
		expect(prompt).toContain('mcp__notion__notion-search');
	});
	it('shows loaded and discoverable tools in one section without duplicates', () => {
		const read = tool('read', 'Read a file');
		const prompt = addToolsPrompt(
			'base',
			[read],
			[read, tool('write', 'Write a file'), tool('mcp__notion__notion-search', 'Search Notion')]
		);

		expect(prompt.match(/^## Tools$/gm)).toHaveLength(1);
		expect(prompt).not.toContain('### Loaded tools');
		expect(prompt).toContain('- `read` (read) — Read a file _(Loaded.)_');
		expect(prompt).toContain(
			'- `write` (write) — Write a file _(Available through `tool_search`.)_'
		);
		expect(prompt).toContain(
			'- `mcp__notion__notion-search` (mcp__notion__notion-search) — Search Notion _(Available through `tool_search`.)_'
		);
		expect(prompt.match(/`read`/g)).toHaveLength(1);
	});
});

describe('buildSystemPrompt', () => {
	it('keeps the native tool catalog visible in minimal context', async () => {
		const prompt = await buildSystemPrompt(
			{ location: '/workspace' },
			[tool('read', 'Read a file'), tool('write', 'Write a file')],
			[],
			undefined,
			'minimal'
		);

		expect(prompt).toContain('- `read` (read) — Read a file');
		expect(prompt).toContain('- `write` (write) — Write a file');
	});
});

describe('addSkillPrompt', () => {
	it('appends loaded instructions without exposing the skill catalog', () => {
		const loaded = {
			id: 'writer',
			name: 'Writer',
			canonicalRoot: '/skills/writer',
			instructions: 'Follow this workflow.',
			trust: 'user-controlled' as const,
			hash: 'abc',
			resources: ['references/guide.md'],
		};
		const prompt = addSkillPrompt('base', [loaded]);

		expect(prompt).not.toContain('Draft documents');
		expect(prompt).not.toContain('Available skill routing metadata');
		expect(prompt).toContain('"canonicalRoot":"/skills/writer"');
		expect(prompt).toContain('Follow this workflow.');
		expect(prompt).toContain(
			'Call those tools only when the user explicitly asks to list, load, or use skills.'
		);
		expect(prompt).toContain(
			'A request merely matching a skill description is not authorization to call a skill tool.'
		);
	});
	it('retains loaded instructions when the installed skill catalog is empty', () => {
		const prompt = addSkillPrompt(
			'base',
			[
				{
					id: 'writer',
					name: 'Writer',
					canonicalRoot: '/skills/writer',
					instructions: 'Follow this workflow.',
					trust: 'user-controlled',
					hash: 'abc',
					resources: [],
				},
			],
			false
		);

		expect(prompt).toContain('<skill_content');
		expect(prompt).toContain('Follow this workflow.');
	});
});
