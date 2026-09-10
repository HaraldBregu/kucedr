import type { AgentToolEffect } from '../../../shared/agent_types';

export interface ToolCapability {
	readonly effects: readonly AgentToolEffect[];
	readonly approval?: boolean;
}

const READ = new Set([
	'read',
	'search_web',
	'fetch_web_page',
	'query_knowledge',
	'query_wiki',
	'search_wiki',
	'read_wiki_page',
	'get_recent_wiki_activity',
	'list_a2a_agents',
	'list_apps',
	'list_memories',
	'get_task',
	'list_tasks',
	'list_skills',
	'load_skill',
	'get_goal',
	'ask',
	'subagent',
	'subagents',
	'get_a2a_task',
	'camera_recorder_status',
	'microphone_recorder_status',
	'screen_recorder_status',
]);
const WRITE = new Set(['write', 'edit', 'patch', 'undo', 'redo', 'complete_bootstrap']);
const PERSIST = new Set([
	'save_memory',
	'forget_memory',
	'update_health',
	'update_health_settings',
	'create_task',
	'update_task',
	'pause_task',
	'resume_task',
	'delete_task',
	'run_task_now',
	'ingest_wiki_source',
	'save_wiki_analysis',
	'review_wiki_changes',
	'rebuild_wiki_index',
]);
const GOAL = new Set([
	'update_goal_plan',
	'record_goal_evidence',
	'request_goal_completion',
	'report_goal_blocker',
]);
const RECORD = new Set(['camera_recorder', 'microphone_recorder', 'screen_recorder']);
const CONTROL = new Set([
	'camera_recorder_stop',
	'microphone_recorder_stop',
	'screen_recorder_stop',
]);
const PAID = new Set(['create_image', 'create_sound', 'create_video']);
const EXTERNAL = new Set(['delegate_a2a', 'cancel_a2a_task', 'open_apps', 'close_apps']);

export function builtinCapability(
	id: string,
	input: Record<string, unknown>
): ToolCapability | undefined {
	if (READ.has(id)) return { effects: ['read'] };
	if (WRITE.has(id)) return { effects: ['write'] };
	if (GOAL.has(id)) return { effects: ['persistence'] };
	if (PERSIST.has(id)) return { effects: ['write', 'persistence'] };
	if (id === 'microphone_recorder' || id === 'screen_recorder') {
		return { effects: ['sensor', 'write'] };
	}
	if (RECORD.has(id)) return { effects: ['sensor', 'write'], approval: true };
	if (CONTROL.has(id)) return { effects: ['sensor'] };
	if (PAID.has(id)) return { effects: ['paid', 'write'] };
	if (EXTERNAL.has(id)) return { effects: ['external'], approval: true };
	if (id === 'bash') return { effects: ['execute'] };
	if (id === 'process')
		return {
			effects: ['list', 'log', 'poll'].includes(String(input.action)) ? ['read'] : ['execute'],
		};
	if (id === 'lint_wiki') return { effects: input.autoFix === true ? ['write'] : ['read'] };
	if (id === 'use_web_browser') {
		const passive = ['status', 'tabs', 'snapshot', 'screenshot', 'console'].includes(
			String(input.action)
		);
		return { effects: passive ? ['read'] : ['external'] };
	}
	return undefined;
}
