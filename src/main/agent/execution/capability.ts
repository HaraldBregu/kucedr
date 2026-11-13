import type { AgentToolEffect } from '../../../shared/agent_types';

export interface ToolCapability {
	readonly effects: readonly AgentToolEffect[];
	readonly approval?: boolean;
}

const READ = new Set([
	'read',
	'get_health',
	'get_identity',
	'get_soul',
	'get_user',
	'list_tasks',
	'list_skills',
	'load_skill',
	'ask',
	'select_screen_source',
	'camera_recorder_status',
	'microphone_recorder_status',
	'screen_recorder_status',
	'load_script',
	'run_script',
]);
const WRITE = new Set(['write', 'edit', 'patch', 'undo', 'redo', 'complete_bootstrap']);
const PERSIST = new Set([
	'create_task',
	'update_task',
	'delete_task',
	'update_health',
	'update_identity',
	'update_soul',
	'update_user',
]);
const EXTERNAL = new Set(['search_web', 'fetch_web_page', 'query_knowledge']);
const RECORD = new Set(['camera_recorder', 'microphone_recorder', 'screen_recorder']);
const CONTROL = new Set([
	'camera_recorder_stop',
	'microphone_recorder_stop',
	'screen_recorder_stop',
]);
const PAID = new Set(['create_image', 'create_sound', 'create_video']);

export function builtinCapability(
	id: string,
	input: Record<string, unknown>
): ToolCapability | undefined {
	if (READ.has(id)) return { effects: ['read'] };
	if (WRITE.has(id)) return { effects: ['write'] };
	if (PERSIST.has(id)) return { effects: ['write', 'persistence'] };
	if (id === 'microphone_recorder' || id === 'screen_recorder') {
		return { effects: ['sensor', 'write'] };
	}
	if (RECORD.has(id)) return { effects: ['sensor', 'write'], approval: id === 'camera_recorder' };
	if (CONTROL.has(id)) return { effects: ['sensor'] };
	if (PAID.has(id)) return { effects: ['paid', 'write'] };
	if (id === 'bash') return { effects: ['execute'] };
	if (id === 'process')
		return {
			effects: ['list', 'log', 'poll'].includes(String(input.action)) ? ['read'] : ['execute'],
		};
	if (id === 'use_web_browser') {
		if (input.action === 'screenshot') return { effects: ['read', 'write'] };
		if (input.action === 'pdf') return { effects: ['external', 'write'] };
		const passive = ['status', 'tabs', 'snapshot', 'console'].includes(
			String(input.action)
		);
		return { effects: passive ? ['read'] : ['external'] };
	}
	return undefined;
}
