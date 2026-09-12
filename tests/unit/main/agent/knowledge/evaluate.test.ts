import corpus from '../../../../fixtures/knowledge-evaluation.json';
import {
	evaluateKnowledge,
	type KnowledgeEvaluationCase,
	type KnowledgeEvaluationObservation,
} from '../../../../../src/main/agent/knowledge/evaluate';

it('measures the offline knowledge acceptance metrics', () => {
	const observations: KnowledgeEvaluationObservation[] = [
		{
			id: 'local-rag-result',
			route: 'rag',
			retrievedSourceIds: ['rag:unrelated', 'rag:architecture-notes'],
			citedSourceIds: ['rag:architecture-notes'],
			claimGrounding: { 'claim-runtime-limit': true },
			abstained: false,
			memorySaved: true,
			latencyMs: 25,
			inputTokens: 65,
			outputTokens: 25,
			estimatedCostUsd: 0,
		},
		...['insufficient-evidence', 'prompt-injection-source'].map(
			(id): KnowledgeEvaluationObservation => ({
				id,
				route: 'abstain',
				retrievedSourceIds: [],
				citedSourceIds: [],
				claimGrounding: {},
				abstained: true,
				memorySaved: false,
				latencyMs: 10,
				inputTokens: 30,
				outputTokens: 5,
				estimatedCostUsd: 0,
			}),
		),
	];

	expect(evaluateKnowledge(corpus as KnowledgeEvaluationCase[], observations, 2)).toEqual({
		cases: 3,
		routeAccuracy: 1,
		recallAtK: 1,
		meanReciprocalRank: 0.5,
		citationPrecision: 1,
		citationRecall: 1,
		groundedAnswerFaithfulness: 1,
		abstentionAccuracy: 1,
		memorySavePrecision: 1,
		averageLatencyMs: 15,
		totalTokens: 160,
		estimatedCostUsd: 0,
	});
});

it('rejects incomplete observations instead of silently skewing results', () => {
	expect(() => evaluateKnowledge(corpus as KnowledgeEvaluationCase[], [])).toThrow(
		'Missing knowledge evaluation observation: local-rag-result'
	);
});
