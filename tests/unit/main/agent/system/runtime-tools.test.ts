import { buildRuntimeTools } from '../../../../../src/main/agent/system/system_build_runtime_tools';
import type { Tool } from '../../../../../src/main/agent/types';

const candidate = (
	id: string,
	category: Tool['category'],
	description: string,
	policy?: Tool['policy']
): Tool => ({ id, category, name: id, description, policy }) as Tool;

it('groups runtime tools by availability and category with descriptions and usage boundaries', () => {
	const read = candidate('read', 'workspace', 'Read a file.');
	const subagent = candidate('subagent', 'delegation', 'Delegate one independent task.');
	const camera = candidate('camera_recorder', 'system', 'Record camera video.');
	const image = candidate('create_image', 'media', 'Generate images.');
	const web = candidate('search_web', 'web', 'Search the web.');
	const listSkills = candidate('list_skills', 'skill', 'List skills.');
	const loadSkill = candidate('load_skill', 'skill', 'Load a skill.');
	const search = candidate('tool_search', 'discovery', 'Find relevant tools.');
	const gmail = candidate('mcp__gmail__search_threads', 'integration', 'Search Gmail threads.', {
		kind: 'mcp',
		serverId: 'gmail',
		toolName: 'search_threads',
	});

	const context = buildRuntimeTools(
		[read, subagent, search],
		[read, subagent, camera, image, web, listSkills, loadSkill, search, gmail, read]
	);

	expect(context).toContain('### Loaded tools');
	expect(context).toContain(
		'#### Workspace\nRead, edit, and run work in the workspace.\n- `read` — Read a file.'
	);
	expect(context).toContain(
		'#### Delegation\nDelegate and coordinate work with other agents.\n- `subagent` — Delegate one independent task.'
	);
	expect(context).toContain(
		'#### Discovery\nFind tools that can be loaded on demand.\n- `tool_search` — Find relevant tools.'
	);
	expect(context).toContain('### Available through `tool_search`');
	expect(context).toContain(
		'#### System\nInteract with the user and local device capabilities.\n- `camera_recorder` — Record camera video. _(Explicit user request only.)_'
	);
	expect(context).toContain(
		'#### Media\nCreate and edit images, video, and audio.\n- `create_image` — Generate images. _(Explicit user request only.)_'
	);
	expect(context).toContain(
		'#### Web\nSearch, retrieve, and interact with web content.\n- `search_web` — Search the web. _(Explicit user request only.)_'
	);
	expect(context).toContain(
		'#### Skills\nFind and load reusable instructions and capabilities.\n- `list_skills` — List skills. _(Explicit user request only.)_\n- `load_skill` — Load a skill. _(Explicit user request only.)_'
	);
	expect(context).toContain(
		'Web access rule: Do not call `search_web`, `fetch_web_page`, or `use_web_browser` merely because the user asks about a person, organization, place, or topic.'
	);
	expect(context).toContain(
		'When the user explicitly asks to search, browse, look up, or verify something online, asks to use a browser or web tool'
	);
	expect(context).toContain(
		'Do not ask for web permission again, offer a menu of possible searches instead of acting, or require another confirmation.'
	);
	expect(context).toContain(
		'#### Integrations\nUse tools provided by connected services.\n- `mcp__gmail__search_threads` — Search Gmail threads.'
	);
	expect(context.match(/`read`/g)).toHaveLength(1);
});

it('reports when no tools are available', () => {
	expect(buildRuntimeTools([])).toBe(
		'## Tools available in this runtime\n\nNo tools are available for this model turn.'
	);
});
