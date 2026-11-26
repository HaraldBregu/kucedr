export const DEFAULT_WORKSPACE = 'default';

export interface WorkspaceRecord {
	id: string;
	name: string;
	folder: string;
	image?: string;
}
