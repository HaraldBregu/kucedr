export interface FileSnapshot {
	path: string;
	exists: boolean;
	content?: string;
	mode?: number;
	hash?: string;
	tooLarge?: boolean;
}

export interface FileOperation {
	id: string;
	runId: string;
	toolCallId: string;
	toolName: string;
	createdAt: string;
	before: FileSnapshot[];
	after: FileSnapshot[];
	state: 'applied' | 'undone';
}

export interface FileHistory {
	operations: FileOperation[];
}
