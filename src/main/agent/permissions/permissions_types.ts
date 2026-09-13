export type PermissionMode = 'allow' | 'deny' | 'ask';

export type PermissionBucket = 'allow' | 'deny';
export type PermissionKind = 'read' | 'write' | 'exec';

export interface PermissionRules {
	allow: string[];
	deny: string[];
}

export interface ToolConfiguration {
	enabled: boolean;
	permission: PermissionMode;
}

export interface PermissionsSchema {
	read: PermissionRules;
	write: PermissionRules;
	exec: PermissionRules;
	tools?: Record<string, ToolConfiguration>;
}

export const EMPTY_PERMISSIONS: PermissionsSchema = {
	read: { allow: [], deny: [] },
	write: { allow: [], deny: [] },
	exec: { allow: [], deny: [] },
};
