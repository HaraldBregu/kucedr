import { contextAllowsTool, type FileAccessContext } from '../context';
import { AGENT_DIRECTORY } from '../agent_store';
import { registry } from '../tools/core/process';
import { directoryPermissionTargets, TASK_TOOLS } from './directory_permission_targets';
import { isBroadTarget } from './broad';
import { isSkillTarget } from './skill_target';
import { isMediaOutputTool } from './media_output_tool';
import { permissionFor } from './permission_for';
import { isProtectedTarget } from './protected_target';
import { toolPermissionTargets } from './tool_permission_targets';
import type { PermissionKind, PermissionMode, PermissionsSchema } from './permissions_types';
import type { ToolPermissionResolution } from './permission_resolution';
import { toolApprovalTargets } from './tool_approval_targets';
import { resolveCommandPermission } from './command';
import type { FileHistory } from '../history/types';

export function resolveLocationPermission(
	toolName: string,
	args: Record<string, unknown>,
	kind: PermissionKind | undefined,
	context: FileAccessContext | undefined,
	reuseContext: boolean,
	fallback: PermissionMode,
	permissions: PermissionsSchema,
	history?: FileHistory
): ToolPermissionResolution {
	if (!kind) {
		return { mode: 'allow', targets: [], approvalTargets: [], persistable: false };
	}

	if (toolName === 'process') {
		const session = typeof args.sessionId === 'string' ? registry.owned(args.sessionId) : undefined;
		if (session?.executionMode === 'sandbox')
			return {
				mode: 'allow',
				kind,
				targets: directoryPermissionTargets(toolName, args, AGENT_DIRECTORY, history),
				approvalTargets: [],
				persistable: false,
			};
		if (
			!session ||
			['list', 'poll', 'log', 'kill', 'clear', 'remove'].includes(String(args.action))
		)
			return { mode: 'allow', kind, targets: [], approvalTargets: [], persistable: false };
		return {
			mode: fallback,
			kind,
			targets: [session.workdir],
			approvalTargets: [session.workdir],
			reason: 'host_execution',
			persistable: false,
		};
	}

	if (toolName === 'bash')
		return resolveCommandPermission(args, permissions, AGENT_DIRECTORY, fallback);
	const targets =
		kind === 'write'
			? directoryPermissionTargets(toolName, args, AGENT_DIRECTORY, history)
			: toolPermissionTargets(toolName, args, AGENT_DIRECTORY);
	const decisions = targets.map((target) =>
		!TASK_TOOLS.has(toolName) && isProtectedTarget(target, kind)
			? 'deny'
			: permissionFor(permissions[kind], target, kind)
	);
	if ((toolName === 'undo' || toolName === 'redo') && targets.length === 0)
		return { mode: 'allow', kind, targets, approvalTargets: [], persistable: false };
	if (
		TASK_TOOLS.has(toolName) ||
		(isMediaOutputTool(toolName, args) && typeof args.directory !== 'string')
	) {
		return {
			mode: decisions.includes('deny') ? 'deny' : 'allow',
			kind,
			targets,
			approvalTargets: [],
			persistable: false,
		};
	}
	const approvalTargets = [
		...new Set(
			toolApprovalTargets(toolName, args, AGENT_DIRECTORY, history).filter(
				(_target, index) => decisions[index] !== 'allow'
			)
		),
	];
	if (decisions.includes('deny'))
		return { mode: 'deny', kind, targets, approvalTargets, persistable: false };
	if (
		(kind === 'read' && fallback !== 'deny') ||
		(targets.length > 0 && decisions.every((decision) => decision === 'allow')) ||
		(kind === 'read' && targets.length > 0 && targets.every(isSkillTarget))
	)
		return { mode: 'allow', kind, targets, approvalTargets, persistable: false };
	if (reuseContext && contextAllowsTool(context, toolName, args, AGENT_DIRECTORY))
		return { mode: 'allow', kind, targets, approvalTargets, persistable: false };
	return {
		mode: fallback,
		kind,
		targets,
		approvalTargets,
		reason: 'outside_trusted_location',
		persistable: approvalTargets.length > 0 && !approvalTargets.some(isBroadTarget),
	};
}
