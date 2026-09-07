import { contextAllowsTool, type FileAccessContext } from '../context';
import { AGENT_DIRECTORY, getPermissions } from '../agent_store';
import { registry } from '../tools/core/process';
import { directoryPermissionTargets, isWritePermissionTool } from './directory_permission_targets';
import { permissionFor } from './permission_for';
import { toolPermissionTargets } from './tool_permission_targets';
import type { PermissionKind, PermissionMode, PermissionsSchema } from './permissions_types';
import type { ToolPermissionResolution } from './permission_resolution';
import { toolApprovalTargets } from './tool_approval_targets';
import { resolveCommandPermission } from './command';
import type { FileHistory } from '../history/types';

export function resolveToolPermissionDetails(
	toolName: string,
	args: Record<string, unknown> = {},
	context?: FileAccessContext,
	reuseContext = true,
	fallback: PermissionMode = 'ask',
	configuredPermissions?: PermissionsSchema,
	history?: FileHistory
): ToolPermissionResolution {
	let kind: PermissionKind | undefined;
	if (toolName === 'read') kind = 'read';
	else if (isWritePermissionTool(toolName, args)) kind = 'write';
	else if (toolName === 'bash' || toolName === 'process') kind = 'exec';
	if (!kind) return { mode: 'allow', targets: [], approvalTargets: [], persistable: false };

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

	const permissions = configuredPermissions ?? getPermissions();
	if (toolName === 'bash') return resolveCommandPermission(args, permissions, AGENT_DIRECTORY, fallback);
	const targets =
		kind === 'write' || kind === 'exec'
			? directoryPermissionTargets(toolName, args, AGENT_DIRECTORY, history)
			: toolPermissionTargets(toolName, args, AGENT_DIRECTORY);
	const decisions = targets.map((target) =>
		kind === 'exec' && args.elevated !== true &&
			(['read', 'write'] as const).some((capability) => permissionFor(permissions[capability], target, capability) === 'deny')
			? 'deny'
			: permissionFor(permissions[kind], target, kind, args.elevated === true)
	);
	const approvalTargets = [
		...new Set(
			toolApprovalTargets(toolName, args, AGENT_DIRECTORY, history).filter(
				(_target, index) => decisions[index] !== 'allow'
			)
		),
	];
	if (decisions.includes('deny'))
		return { mode: 'deny', kind, targets, approvalTargets, persistable: false };
	if (kind === 'read' || (targets.length > 0 && decisions.every((decision) => decision === 'allow')))
		return { mode: 'allow', kind, targets, approvalTargets, persistable: false };
	if (reuseContext && contextAllowsTool(context, toolName, args, AGENT_DIRECTORY))
		return { mode: 'allow', kind, targets, approvalTargets, persistable: false };
	const hostExecution = kind === 'exec' && args.elevated === true;
	return {
		mode: fallback,
		kind,
		targets,
		approvalTargets,
		reason: hostExecution ? 'host_execution' : 'outside_trusted_location',
		persistable: !hostExecution && approvalTargets.length > 0,
	};
}

export function resolveToolPermission(
	toolName: string,
	args: Record<string, unknown> = {},
	context?: FileAccessContext,
	reuseContext = true,
	fallback: PermissionMode = 'ask',
	configuredPermissions?: PermissionsSchema,
	history?: FileHistory
): PermissionMode {
	return resolveToolPermissionDetails(
		toolName,
		args,
		context,
		reuseContext,
		fallback,
		configuredPermissions,
		history
	).mode;
}
