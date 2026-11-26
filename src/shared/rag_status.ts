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
	skippedReasons: Partial<Record<RagSkipReason, number>>;
	skippedFiles: RagSkipped[];
}

export interface RagStatus {
	running: boolean;
	trigger: RagIndexTrigger | null;
	startedAt: string | null;
	finishedAt: string | null;
	outcome: 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';
	error: string | null;
	result: RagIndexResult | null;
	progress?: { done: number; total: number } | null;
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
	sources?: Array<{
		folder: string;
		files: number;
		chunks: number;
		indexedAt: string | null;
		error: string | null;
	}>;
}
