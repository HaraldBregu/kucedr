import path from 'node:path';
import { realPath } from '../../shared/real_path';
import { hasCreatedFile, hasToolPermission } from '../context';
import { isBroadTarget } from './broad';
import { isProtectedTarget } from './protected_target';
import { ruleMatches } from './rule_matches';
import { isSkillTarget } from './skill_target';
import type { PermissionKind } from './permissions_types';
import type {
	PermissionGrant,
	PermissionRequest,
	ToolPermissionResolution,
} from './permission_resolution';

const KINDS: PermissionKind[] = ['read', 'write', 'exec'];
const GLOB = /[*?[\]{}]/;

export function resolvePermission({
	access = {},
	permissions,
	setting,
	approval = false,
	interactive,
	context,
}: PermissionRequest): ToolPermissionResolution {
	const entries = KINDS.flatMap((kind) =>
		(access[kind] ?? []).map((target) => {
			const resolved = realPath(target);
			return {
				kind,
				target: resolved,
				folder: kind === 'exec' || access.folders ? resolved : path.dirname(resolved),
			};
		})
	);
	const denied: ToolPermissionResolution = {
		mode: 'deny',
		approvalTargets: [],
		grants: [],
		persistable: false,
	};
	if (
		setting === 'deny' ||
		entries.some(
			({ kind, target }) =>
				(!access.managed && isProtectedTarget(target, kind === 'read' ? 'read' : 'write')) ||
				(kind === 'exec' ? KINDS : access.exec ? [kind, 'exec' as const] : [kind]).some((ruleKind) =>
					permissions[ruleKind].deny.some((rule) => ruleMatches(rule, target))
				)
		)
	)
		return denied;
	const grants: PermissionGrant[] = [
		...new Map(
			entries
				.filter(
					({ kind, target }) =>
						!access.managed &&
						!permissions[kind].allow.some((rule) => ruleMatches(rule, target)) &&
						!(
							kind === 'read' &&
							(interactive ||
								isSkillTarget(target) ||
								hasToolPermission(context, path.dirname(target)))
						) &&
						!(kind === 'write' && hasCreatedFile(context, target))
				)
				.map(({ kind, folder }) => [`${kind}:${folder}`, { kind, root: folder }] as const)
		).values(),
	];
	const sensitive = setting === 'ask' || approval || access.host === true;
	if (!sensitive && grants.length === 0)
		return { mode: 'allow', approvalTargets: [], grants, persistable: false };
	const approvalTargets = [
		...new Set(grants.length > 0 ? grants.map(({ root }) => root) : entries.map(({ folder }) => folder)),
	];
	if (!interactive || approvalTargets.some((target) => /[*?[\]{}]/.test(target))) return denied;
	return {
		mode: 'ask',
		approvalTargets,
		grants,
		reason: approval
			? 'sensitive_operation'
			: access.host
				? 'host_execution'
				: 'outside_trusted_location',
		persistable: !sensitive && !approvalTargets.some(isBroadTarget),
	};
}
