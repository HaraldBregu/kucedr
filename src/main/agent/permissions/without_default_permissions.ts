import type { PermissionKind, PermissionRules, PermissionsSchema } from './permissions_types';

export function withoutDefaultPermissions(
	permissions: PermissionsSchema,
	workspacePattern: string,
	legacyPattern?: string
): PermissionsSchema {
	const rules = (kind: PermissionKind): PermissionRules => {
		const { allow, deny } = permissions[kind];
		const merged = allow.includes(workspacePattern);
		return {
			allow: allow.filter(
				(rule) => rule !== workspacePattern && !(merged && rule === legacyPattern)
			),
			deny: [...deny],
		};
	};
	return { read: rules('read'), write: rules('write'), exec: rules('exec') };
}
