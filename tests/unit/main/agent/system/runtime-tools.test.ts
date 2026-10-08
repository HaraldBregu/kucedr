import { buildRuntimeTools } from '../../../../../src/main/agent/system/system_build_runtime_tools';
import type { Tool } from '../../../../../src/main/agent/types';

const candidate = (id: string, description: string, policy?: Tool['policy']): Tool =>
	({ id, name: id, description, policy }) as Tool;

it('groups runtime tools by availability and category with descriptions and usage boundaries', () => {
	const read = candidate('read', 'Read a file.');
	const subagent = candidate('subagent', 'Delegate one independent task.');
	const camera = candidate('camera_recorder', 'Record camera video.');
	const image = candidate('create_image', 'Generate images.');
	const web = candidate('search_web', 'Search the web.');
	const search = candidate('tool_search', 'Find relevant tools.');
	const gmail = candidate('mcp__gmail__search_threads', 'Search Gmail threads.', {
		kind: 'mcp',
		serverId: 'gmail',
		toolName: 'search_threads',
	});

	const context = buildRuntimeTools(
		[read, subagent, search],
		[read, subagent, camera, image, web, search, gmail, read]
	);

	expect(context).toContain('### Loaded tools');
	expect(context).toContain('#### Core\n- `read` — Read a file.');
	expect(context).toContain('#### Delegation\n- `subagent` — Delegate one independent task.');
	expect(context).toContain('#### Discovery\n- `tool_search` — Find relevant tools.');
	expect(context).toContain('### Available through `tool_search`');
	expect(context).toContain(
		'#### System\n- `camera_recorder` — Record camera video. _(Explicit user request only.)_'
	);
	expect(context).toContain(
		'#### Media\n- `create_image` — Generate images. _(Explicit user request only.)_'
	);
	expect(context).toContain(
		'#### Web\n- `search_web` — Search the web. _(Explicit user request only.)_'
	);
	expect(context).toContain(
		'Web access rule: Do not call `search_web`, `fetch_web_page`, or `use_web_browser` merely because the user asks about a person, organization, place, or topic.'
	);
	expect(context).toContain(
		'If an accurate answer requires current or external information and the user has not authorized web access, explain that a web search is needed, ask whether they want you to perform it, and wait for their response.'
	);
	expect(context).toContain(
		'#### Integrations\n- `mcp__gmail__search_threads` — Search Gmail threads.'
	);
	expect(context.match(/`read`/g)).toHaveLength(1);
});

it('reports when no tools are available', () => {
	expect(buildRuntimeTools([])).toBe(
		'## Tools available in this runtime\n\nNo tools are available for this model turn.'
	);
});
