export type RagIndexTrigger = 'manual' | 'scheduled';

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
	index: {
		indexName: string;
		providerId: string;
		modelId: string;
		dimensions: number;
		completedAt: string;
	} | null;
}
