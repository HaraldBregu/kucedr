export const DEFAULT_WORKSPACE = 'default';
export const DEFAULT_WORKSPACE_NAME = 'Personal';

export interface WorkspaceRecord {
	id: string;
	name: string;
	folder: string;
	image?: string;
}

export interface WorkspaceInfo {
	id: string;
	name: string;
	folder: string;
	image?: string;
	missing: boolean;
	running?: number;
	waiting?: number;
}

export interface WorkspaceContents {
	chats: { id: string; title: string; archived: boolean }[];
	tasks: string[];
	browser: boolean;
}

export interface WorkspacesState {
	current: string;
	workspaces: WorkspaceInfo[];
}

export interface WorkspacesApi {
	list(): Promise<WorkspacesState>;
	select(id: string): Promise<void>;
	create(): Promise<WorkspaceInfo | null>;
	rename(id: string, name: string): Promise<void>;
	locate(id: string): Promise<boolean>;
	openWindow(id: string): Promise<void>;
	pickImage(id: string): Promise<boolean>;
	removeImage(id: string): Promise<void>;
	contents(id: string): Promise<WorkspaceContents>;
	reveal(id: string): Promise<void>;
	remove(id: string, deleteChats: boolean): Promise<void>;
	onChanged(callback: () => void): () => void;
}
