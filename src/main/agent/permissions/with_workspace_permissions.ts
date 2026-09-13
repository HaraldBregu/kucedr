import type { PermissionsSchema } from './permissions_types';

export function withWorkspacePermissions(
	permissions: PermissionsSchema,
	workspacePattern: string
): PermissionsSchema {
	return {
		read: {
			allow: [...new Set([workspacePattern, ...permissions.read.allow])],
			deny: [...permissions.read.deny],
		},
		write: {
			allow: [...new Set([workspacePattern, ...permissions.write.allow])],
			deny: [...permissions.write.deny],
		},
		exec: {
			allow: [...new Set([workspacePattern, ...permissions.exec.allow])],
			deny: [...permissions.exec.deny],
		},
		...(permissions.tools ? { tools: { ...permissions.tools } } : {}),
	};
}
