import path from 'node:path';
import { realPath } from '../../shared/real_path';
import { resolveUserPath } from '../../shared/user_path';
import { taskStorePath } from '../../tasks/tasks_store';
import { healthStorePath } from '../health/health_store';
import { skillsRoot } from '../skills/skills_root';
import { registry } from '../tools/core/process';
import { toolPermissionTargets } from './tool_permission_targets';
import { getWikiSettings } from '../knowledge/wiki/wiki_get_settings';
import { resolveExecRoots } from './resolve_exec_roots';
import { fileHistoryTargets } from '../history/targets';
import type { FileHistory } from '../history/types';

const AGENT_FILES: Record<string, string> = {
	save_memory: 'MEMORY.md',
	forget_memory: 'MEMORY.md',
	update_health: 'HEALTH.md',
	complete_bootstrap: 'BOOTSTRAP.md',
};
export const MEDIA_TOOLS = new Set([
	'create_image',
	'create_video',
	'create_sound',
	'microphone_recorder',
	'camera_recorder',
	'screen_recorder',
]);
const TASK_TOOLS = new Set([
	'create_task',
	'update_task',
	'pause_task',
	'resume_task',
	'delete_task',
	'run_task_now',
]);
export const TASK_MUTATION_TOOLS = new Set(['create_task', 'update_task', 'delete_task']);
const WIKI_TOOLS = new Set([
	'ingest_wiki_source',
	'save_wiki_analysis',
	'lint_wiki',
	'review_wiki_changes',
	'rebuild_wiki_index',
]);

export function isWritePermissionTool(toolName: string, args: Record<string, unknown>): boolean {
	return (
		toolName === 'write' ||
		toolName === 'edit' ||
		toolName === 'patch' ||
		toolName === 'undo' ||
		toolName === 'redo' ||
		toolName in AGENT_FILES ||
		toolName === 'update_health_settings' ||
		MEDIA_TOOLS.has(toolName) ||
		TASK_TOOLS.has(toolName) ||
		(WIKI_TOOLS.has(toolName) && (toolName !== 'lint_wiki' || args.autoFix === true))
	);
}

export function directoryPermissionTargets(
	toolName: string,
	args: Record<string, unknown>,
	baseDir: string,
	history?: FileHistory
): string[] {
	if (toolName === 'bash') {
		return resolveExecRoots(args, baseDir);
	}
	if (toolName === 'undo') return history ? fileHistoryTargets(history, 'undo') : [];
	if (toolName === 'redo') return history ? fileHistoryTargets(history, 'redo') : [];
	if (toolName === 'process') {
		const session = typeof args.sessionId === 'string' ? registry.get(args.sessionId) : undefined;
		return session && session.executionMode === 'sandbox'
			? [realPath(session.workdir), ...(session.roots ?? []).map(realPath)]
			: [];
	}
	if (typeof args.path === 'string' || toolName === 'patch') {
		const targets = toolPermissionTargets(toolName, args, baseDir);
		return toolName === 'read' ? targets.map((target) => path.dirname(target)) : targets;
	}
	const fileName = AGENT_FILES[toolName];
	if (fileName) return [realPath(path.join(baseDir, fileName))];
	if (toolName === 'update_health_settings') return [realPath(healthStorePath)];
	if (MEDIA_TOOLS.has(toolName)) {
		const directory = typeof args.directory === 'string' && args.directory ? args.directory : '.';
		return [realPath(resolveUserPath(directory, baseDir))];
	}
	if (TASK_TOOLS.has(toolName)) return [realPath(taskStorePath)];
	if (WIKI_TOOLS.has(toolName)) {
		return [realPath(path.resolve(getWikiSettings().targetPath, 'index.md'))];
	}
	if (toolName === 'load_skill') return [realPath(path.join(skillsRoot, String(args.name ?? '')))];
	return [];
}
