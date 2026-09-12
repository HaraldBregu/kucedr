export interface KnowledgeScanBudget {
	entries: number;
	files: number;
	bytes: number;
}

export type KnowledgeRoute = 'rag' | 'abstain';

export interface KnowledgeEvaluationCase {
	id: string;
	expectedRoute: KnowledgeRoute;
	relevantSourceIds: string[];
	expectedClaimIds: string[];
	requiresAbstention: boolean;
	expectedMemorySave: boolean;
}

export interface KnowledgeEvaluationObservation {
	id: string;
	route: KnowledgeRoute;
	retrievedSourceIds: string[];
	citedSourceIds: string[];
	claimGrounding: Record<string, boolean>;
	abstained: boolean;
	memorySaved: boolean;
	latencyMs: number;
	inputTokens: number;
	outputTokens: number;
	estimatedCostUsd: number;
}

export interface KnowledgeEvaluationMetrics {
	cases: number;
	routeAccuracy: number;
	recallAtK: number;
	meanReciprocalRank: number;
	citationPrecision: number;
	citationRecall: number;
	groundedAnswerFaithfulness: number;
	abstentionAccuracy: number;
	memorySavePrecision: number;
	averageLatencyMs: number;
	totalTokens: number;
	estimatedCostUsd: number;
}

export interface SourceSafetyInput {
	readonly relativePath: string;
	readonly content: string;
}
