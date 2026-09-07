import path from 'node:path';
import { directoryPermissionTargets, MEDIA_TOOLS } from './directory_permission_targets';
import { toolPermissionTargets } from './tool_permission_targets';
import type { FileHistory } from '../history/types';

export function toolApprovalTargets(
	toolName: string,
	args: Record<string, unknown>,
	baseDir: string,
	history?: FileHistory
): string[] {
	const targets = toolName === 'read'
		? toolPermissionTargets(toolName, args, baseDir)
		: directoryPermissionTargets(toolName, args, baseDir, history);
	return toolName === 'bash' || toolName === 'process' || MEDIA_TOOLS.has(toolName)
		? targets
		: targets.map((target) => path.dirname(target));
}
