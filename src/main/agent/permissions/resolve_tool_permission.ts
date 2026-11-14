import type { FileAccessContext } from '../context';
import { getPermissions } from '../agent_store';
import { isWritePermissionTool } from './directory_permission_targets';
import { resolveLocationPermission } from './location';
import type { PermissionKind, PermissionMode, PermissionsSchema } from './permissions_types';
import type { ToolPermissionResolution } from './permission_resolution';
import type { FileHistory } from '../history/types';

export function resolveToolPermissionDetails(
	toolName: string,
	args: Record<string, unknown> = {},
	context?: FileAccessContext,
	reuseContext = true,
	fallback: PermissionMode = 'ask',
	configuredPermissions?: PermissionsSchema,
	history?: FileHistory,
	configuredTool?: import('./permissions_types').ToolConfiguration
): ToolPermissionResolution {
	let kind: PermissionKind | undefined;
	if (toolName === 'read') kind = 'read';
	else if (isWritePermissionTool(toolName, args)) kind = 'write';
	else if (toolName === 'bash' || toolName === 'process') kind = 'exec';
	const permissions = configuredPermissions ?? getPermissions();
	const toolSettings = configuredTool ?? permissions.tools?.[toolName];
	if (toolSettings?.permission === 'deny')
		return { mode: 'deny', kind, targets: [], approvalTargets: [], persistable: false };
	const resolution = resolveLocationPermission(
		toolName,
		args,
		kind,
		context,
		reuseContext,
		fallback,
		permissions,
		history
	);
	const mode =
		toolSettings?.permission === 'ask' && resolution.mode === 'allow' ? 'ask' : resolution.mode;
	if (mode === 'ask' && resolution.approvalTargets.some((target) => /[*?[\]{}]/.test(target)))
		return { ...resolution, mode: 'deny', persistable: false };
	if (mode === resolution.mode) return resolution;
	return {
		...resolution,
		mode,
		reason: resolution.reason ?? 'outside_trusted_location',
		persistable: false,
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
