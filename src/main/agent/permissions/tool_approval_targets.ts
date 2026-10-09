import path from 'node:path';
import { directoryPermissionTargets } from './directory_permission_targets';
import { isMediaOutputTool } from './media_output_tool';
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
	return toolName === 'bash' || toolName === 'process' || isMediaOutputTool(toolName, args)
		? targets
		: targets.map((target) => path.dirname(target));
}
