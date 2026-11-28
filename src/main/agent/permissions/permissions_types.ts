import type { AgentToolPermission } from '../../../shared/agent_tools';

export type PermissionMode = AgentToolPermission;

export type PermissionBucket = 'allow' | 'deny';
export type PermissionKind = 'read' | 'write' | 'exec';

export interface PermissionRule {
	root: string;
	recursive: boolean;
}

export interface PermissionRules {
	allow: PermissionRule[];
	deny: PermissionRule[];
}

export interface PermissionsSchema {
	read: PermissionRules;
	write: PermissionRules;
	exec: PermissionRules;
}

export interface PermissionsView extends PermissionsSchema {
	protected: { read: string[]; write: string[] };
	dropped: string[];
}

export interface ToolAccess {
	readonly read?: readonly string[];
	readonly write?: readonly string[];
	readonly exec?: readonly string[];
	readonly managed?: boolean;
	readonly folders?: boolean;
	readonly host?: boolean;
	readonly hosts?: readonly string[];
}

export const EMPTY_PERMISSIONS: PermissionsSchema = {
	read: { allow: [], deny: [] },
	write: { allow: [], deny: [] },
	exec: { allow: [], deny: [] },
};
