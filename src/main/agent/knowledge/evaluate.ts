import type {
	KnowledgeEvaluationCase,
	KnowledgeEvaluationMetrics,
	KnowledgeEvaluationObservation,
} from './types';

export type {
	KnowledgeEvaluationCase,
	KnowledgeEvaluationMetrics,
	KnowledgeEvaluationObservation,
	KnowledgeRoute,
} from './types';

export function evaluateKnowledge(
	corpus: readonly KnowledgeEvaluationCase[],
	observations: readonly KnowledgeEvaluationObservation[],
	k = 5
): KnowledgeEvaluationMetrics {
	if (corpus.length === 0) throw new Error('Knowledge evaluation corpus is empty.');
	if (!Number.isInteger(k) || k < 1) throw new Error('Knowledge evaluation k must be positive.');
	const byId = new Map(observations.map((observation) => [observation.id, observation]));
	let correctRoutes = 0;
	let retrievalCases = 0;
	let recalled = 0;
	let reciprocalRank = 0;
	let relevantCitations = 0;
	let totalCitations = 0;
	let expectedCitations = 0;
	let groundedClaims = 0;
	let totalClaims = 0;
	let correctAbstentions = 0;
	let abstentionCases = 0;
	let correctMemorySaves = 0;
	let predictedMemorySaves = 0;
	let latencyMs = 0;
	let totalTokens = 0;
	let estimatedCostUsd = 0;

	for (const item of corpus) {
		const observation = byId.get(item.id);
		if (!observation) throw new Error(`Missing knowledge evaluation observation: ${item.id}`);
		if (observation.route === item.expectedRoute) correctRoutes += 1;
		const relevant = new Set(item.relevantSourceIds);
		if (relevant.size > 0) {
			retrievalCases += 1;
			const rank = observation.retrievedSourceIds.findIndex((sourceId) => relevant.has(sourceId));
			if (rank >= 0) reciprocalRank += 1 / (rank + 1);
			if (observation.retrievedSourceIds.slice(0, k).some((sourceId) => relevant.has(sourceId))) {
				recalled += 1;
			}
		}
		totalCitations += observation.citedSourceIds.length;
		relevantCitations += observation.citedSourceIds.filter((sourceId) => relevant.has(sourceId)).length;
		expectedCitations += item.relevantSourceIds.length;
		for (const claimId of item.expectedClaimIds) {
			totalClaims += 1;
			if (observation.claimGrounding[claimId] === true) groundedClaims += 1;
		}
		if (item.requiresAbstention) {
			abstentionCases += 1;
			if (observation.abstained) correctAbstentions += 1;
		}
		if (observation.memorySaved) {
			predictedMemorySaves += 1;
			if (item.expectedMemorySave) correctMemorySaves += 1;
		}
		latencyMs += observation.latencyMs;
		totalTokens += observation.inputTokens + observation.outputTokens;
		estimatedCostUsd += observation.estimatedCostUsd;
	}

	return {
		cases: corpus.length,
		routeAccuracy: correctRoutes / corpus.length,
		recallAtK: retrievalCases === 0 ? 1 : recalled / retrievalCases,
		meanReciprocalRank: retrievalCases === 0 ? 1 : reciprocalRank / retrievalCases,
		citationPrecision: totalCitations === 0 ? 1 : relevantCitations / totalCitations,
		citationRecall: expectedCitations === 0 ? 1 : relevantCitations / expectedCitations,
		groundedAnswerFaithfulness: totalClaims === 0 ? 1 : groundedClaims / totalClaims,
		abstentionAccuracy: abstentionCases === 0 ? 1 : correctAbstentions / abstentionCases,
		memorySavePrecision:
			predictedMemorySaves === 0 ? 1 : correctMemorySaves / predictedMemorySaves,
		averageLatencyMs: latencyMs / corpus.length,
		totalTokens,
		estimatedCostUsd,
	};
}
