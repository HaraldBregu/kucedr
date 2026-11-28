import type { FileAccessContext } from '../context';
import type {
	PermissionKind,
	PermissionMode,
	PermissionsSchema,
	ToolAccess,
} from './permissions_types';

export type ToolPermissionReason =
	| 'outside_trusted_location'
	| 'host_execution'
	| 'destructive_operation'
	| 'sensitive_operation'
	| 'network_access';

export interface PermissionGrant {
	readonly kind: PermissionKind;
	readonly root: string;
}

export interface PermissionRequest {
	readonly access?: ToolAccess;
	readonly permissions: PermissionsSchema;
	readonly setting?: PermissionMode;
	readonly approval?: boolean;
	readonly interactive: boolean;
	readonly context?: FileAccessContext;
}

export interface ToolPermissionResolution {
	readonly mode: PermissionMode;
	readonly approvalTargets: string[];
	readonly grants: PermissionGrant[];
	readonly reason?: ToolPermissionReason;
	readonly persistable: boolean;
}
