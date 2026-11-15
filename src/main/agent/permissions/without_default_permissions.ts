import type { PermissionKind, PermissionRule, PermissionRules, PermissionsSchema } from './permissions_types';

export function withoutDefaultPermissions(
	permissions: PermissionsSchema,
	workspace: PermissionRule,
	legacy?: PermissionRule
): PermissionsSchema {
	const same = (rule: PermissionRule, other?: PermissionRule): boolean =>
		other !== undefined && rule.root === other.root && rule.recursive === other.recursive;
	const rules = (kind: PermissionKind): PermissionRules => {
		const { allow, deny } = permissions[kind];
		const merged = allow.some((rule) => same(rule, workspace));
		return {
			allow: allow.filter((rule) => !same(rule, workspace) && !(merged && same(rule, legacy))),
			deny: [...deny],
		};
	};
	return { read: rules('read'), write: rules('write'), exec: rules('exec') };
}
