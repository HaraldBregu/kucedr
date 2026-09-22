import { realPath } from '../../shared/real_path';
import { resolveUserPath } from '../../shared/user_path';
import { permissionFor } from './permission_for';
import { resolveExecRoots } from './resolve_exec_roots';
import type { PermissionMode, PermissionsSchema } from './permissions_types';
import type { ToolPermissionResolution } from './permission_resolution';

export function resolveCommandPermission(
	args: Record<string, unknown>,
	permissions: PermissionsSchema,
	baseDir: string,
	fallback: PermissionMode
): ToolPermissionResolution {
	const targets = resolveExecRoots(args, baseDir);
	const elevated = args.elevated === true;
	const requested = new Set(Array.isArray(args.additionalRoots)
		? args.additionalRoots.filter((value): value is string => typeof value === 'string' && value.length > 0)
			.map((root) => realPath(resolveUserPath(root, targets[0] ?? baseDir)))
		: []);
	const decisions = targets.map((target) => {
		if ((['read', 'write', 'exec'] as const).some((kind) =>
			permissionFor(permissions[kind], target, kind) === 'deny')) return 'deny';
		if (elevated) return fallback;
		if (!requested.has(target)) return 'allow';
		return permissionFor(permissions.exec, target, 'exec') ?? fallback;
	});
	const approvalTargets = targets.filter((_target, index) => decisions[index] !== 'allow');
	return {
		mode: decisions.includes('deny') ? 'deny'
			: targets.length > 0 && decisions.every((decision) => decision === 'allow') ? 'allow' : fallback,
		kind: 'exec',
		targets,
		approvalTargets,
		reason: elevated ? 'host_execution' : 'outside_trusted_location',
		persistable: !elevated && !decisions.includes('deny') && approvalTargets.length > 0,
	};
}
