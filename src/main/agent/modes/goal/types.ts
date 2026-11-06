export type GoalStatus = 'active' | 'paused' | 'blocked' | 'completed' | 'budget_limited';

export interface GoalCriterion {
	id: string;
	description: string;
	satisfied: boolean;
	evidenceIds: string[];
}

export interface GoalStep {
	id: string;
	description: string;
	status: 'pending' | 'active' | 'completed';
}

export interface GoalEvidence {
	id: string;
	source: string;
	summary: string;
	createdAt: number;
}

export interface SessionGoal {
	schemaVersion: 1;
	id: string;
	objective: string;
	status: GoalStatus;
	criteria: GoalCriterion[];
	steps: GoalStep[];
	evidence: GoalEvidence[];
	limits: { maxRuns: number; maxTokens?: number; maxToolCalls?: number };
	usage: { runs: number; inputTokens: number; outputTokens: number; toolCalls: number };
	createdAt: number;
	updatedAt: number;
	statusNote?: string;
}
