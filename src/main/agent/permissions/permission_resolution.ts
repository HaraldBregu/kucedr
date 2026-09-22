import type { PermissionKind, PermissionMode } from './permissions_types';

export type ToolPermissionReason =
	| 'outside_trusted_location'
	| 'host_execution'
	| 'destructive_operation'
	| 'sensitive_operation';

export interface ToolPermissionResolution {
	readonly mode: PermissionMode;
	readonly kind?: PermissionKind;
	readonly targets: string[];
	readonly approvalTargets: string[];
	readonly reason?: ToolPermissionReason;
	readonly persistable: boolean;
}
