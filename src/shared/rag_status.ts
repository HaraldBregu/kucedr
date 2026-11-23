export type RagIndexTrigger = 'manual' | 'scheduled';

export type RagSkipReason = 'unsupported' | 'too-large' | 'credential' | 'symlink' | 'unreadable' | 'empty' | 'limit';

export interface RagSkipped {
	path: string;
	reason: RagSkipReason;
}

export interface RagIndexResult {
	files: number;
	vectors: number;
	skipped: number;
	skippedFiles: RagSkipped[];
}

export interface RagStatus {
	running: boolean;
	trigger: RagIndexTrigger | null;
	startedAt: string | null;
	finishedAt: string | null;
	outcome: 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';
	error: string | null;
	result: { files: number; vectors: number } | null;
	nextRunAt: string | null;
	timezone: string;
	requiresIndexing?: boolean;
	index: {
		indexName: string;
		providerId: string;
		modelId: string;
		dimensions: number;
		completedAt: string;
	} | null;
}
