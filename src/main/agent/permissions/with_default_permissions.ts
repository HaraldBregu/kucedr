import type { PermissionKind, PermissionRule, PermissionRules, PermissionsSchema } from './permissions_types';

export function withDefaultPermissions(
	permissions: PermissionsSchema,
	workspace: PermissionRule
): PermissionsSchema {
	const rules = (kind: PermissionKind): PermissionRules => ({
		allow: [{ ...workspace }, ...permissions[kind].allow],
		deny: [...permissions[kind].deny],
	});
	return { read: rules('read'), write: rules('write'), exec: rules('exec') };
}
