import type { Tool } from '../types';

export function runtimeToolCategory(tool: Tool): string {
	if (tool.policy?.kind === 'mcp') return 'Integrations';
	if (['subagent', 'subagents', 'list_a2a_agents', 'delegate_a2a', 'get_a2a_task', 'cancel_a2a_task'].includes(tool.id)) return 'Delegation';
	if (['read', 'write', 'edit', 'patch', 'bash', 'process', 'undo', 'redo', 'ask'].includes(tool.id)) return 'Core';
	if (['search_web', 'fetch_web_page', 'use_web_browser'].includes(tool.id)) return 'Web';
	if (tool.id.startsWith('create_') && ['create_image', 'create_video', 'create_sound'].includes(tool.id)) return 'Media';
	if (/^(camera|microphone|screen)_recorder/.test(tool.id) || tool.id === 'select_screen_source') return 'System';
	if (tool.id === 'query_knowledge') return 'Knowledge';
	if (['list_skills', 'load_skill'].includes(tool.id)) return 'Skills';
	if (tool.id === 'tool_search') return 'Discovery';
	if (tool.id.includes('task')) return 'Tasks';
	if (tool.id.includes('goal')) return 'Goals';
	if (['get_identity', 'update_identity', 'get_soul', 'update_soul', 'get_user', 'update_user', 'get_health', 'update_health', 'complete_bootstrap'].includes(tool.id)) return 'Profiles and bootstrap';
	if (tool.id === 'request_mcp_authorization') return 'Integrations';
	return 'System';
}
