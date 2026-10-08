import type { RagConfiguration } from '../../../../shared/rag_types';

export function ragIndexingSignature(configuration: RagConfiguration): string {
	const { scheduleEnabled, cronExpression, timezone, ...indexing } = configuration;
	void scheduleEnabled;
	void cronExpression;
	void timezone;
	return JSON.stringify(indexing);
}
