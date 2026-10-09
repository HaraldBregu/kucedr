import type { PermissionsSchema } from './permissions_types';

export function withDefaultPermissions(
	permissions: PermissionsSchema,
	workspacePattern: string,
	libraryPattern: string
): PermissionsSchema {
	return {
		read: {
			allow: [...new Set([workspacePattern, libraryPattern, ...permissions.read.allow])],
			deny: [...permissions.read.deny],
		},
		write: {
			allow: [...new Set([workspacePattern, libraryPattern, ...permissions.write.allow])],
			deny: [...permissions.write.deny],
		},
		exec: {
			allow: [...new Set([workspacePattern, ...permissions.exec.allow])],
			deny: [...permissions.exec.deny],
		},
		...(permissions.tools ? { tools: { ...permissions.tools } } : {}),
	};
}
