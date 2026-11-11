import os from 'node:os';
import path from 'node:path';
import { realPath } from '../../shared/real_path';
import { resolveUserPath } from '../../shared/user_path';
import type { PermissionKind, PermissionMode, PermissionRules } from './permissions_types';
import { permissionRuleRoot } from './permission_rule_root';

export function permissionFor(
	rules: PermissionRules,
	target: string,
	kind: PermissionKind,
	elevated = false
): PermissionMode | undefined {
	const fold = (value: string): string =>
		process.platform === 'darwin' || process.platform === 'win32' ? value.toLowerCase() : value;
	const matches = (rule: string): boolean => {
		if (rule === '*') return true;
		const rawPattern = resolveUserPath(rule, os.homedir());
		const recursiveRoot = rawPattern.endsWith(`${path.sep}**`)
			? fold(permissionRuleRoot(rawPattern))
			: undefined;
		const resolvedTarget = fold(realPath(target));
		if (
			recursiveRoot &&
			(resolvedTarget === recursiveRoot || resolvedTarget.startsWith(`${recursiveRoot}${path.sep}`))
		)
			return true;
		try {
			const pattern = fold(realPath(rawPattern));
			return resolvedTarget === pattern || path.matchesGlob(resolvedTarget, pattern);
		} catch {
			return false;
		}
	};
	if (rules.deny.some(matches)) return 'deny';
	if (kind === 'exec' && elevated) return undefined;
	if (rules.allow.some(matches)) return 'allow';
	return undefined;
}
