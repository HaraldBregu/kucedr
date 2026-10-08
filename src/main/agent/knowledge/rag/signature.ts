import type { RagConfiguration } from '../../../../shared/rag_types';

export function ragIndexingSignature(configuration: RagConfiguration): string {
	const { scheduleEnabled, cronExpression, timezone, minimumScore, ...indexing } = configuration;
	void scheduleEnabled;
	void cronExpression;
	void timezone;
	void minimumScore;
	return JSON.stringify(indexing);
}
