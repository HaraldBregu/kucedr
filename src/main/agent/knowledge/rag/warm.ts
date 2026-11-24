import { getRagConfiguration } from './rag_store';

export function warmRag(): void {
	const configuration = getRagConfiguration();
	if (!configuration.enabled) return;
	void import('./scan')
		.then(({ scanRag }) => scanRag(configuration.indexName))
		.catch(() => undefined);
}
