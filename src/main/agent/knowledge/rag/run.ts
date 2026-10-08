import type { RagIndexTrigger } from '../../../../shared/rag_status';
import { indexRag } from './rag_index';
import { getRagConfiguration } from './rag_store';
import { ragJob } from './job';
import { ragIndexingSignature } from './signature';
import type { RagIndexResult } from './types';

export async function runRagIndexing(trigger: RagIndexTrigger = 'manual'): Promise<RagIndexResult> {
	if (ragJob.running) throw new Error('Knowledge indexing is already running.');
	const configuration = getRagConfiguration();
	if (configuration.enabled !== true) throw new Error('Knowledge is disabled.');
	const controller = new AbortController();
	Object.assign(ragJob, {
		running: true,
		trigger,
		startedAt: new Date().toISOString(),
		finishedAt: null,
		outcome: 'running',
		error: null,
		result: null,
		controller,
		configuration: ragIndexingSignature(configuration),
	});
	try {
		const result = await indexRag(configuration.folders, configuration.indexName, {
			signal: controller.signal,
		});
		controller.signal.throwIfAborted();
		ragJob.result = result;
		ragJob.outcome = 'completed';
		return result;
	} catch (error) {
		ragJob.outcome = controller.signal.aborted ? 'cancelled' : 'failed';
		ragJob.error = error instanceof Error ? error.message : String(error);
		throw error;
	} finally {
		ragJob.running = false;
		ragJob.finishedAt = new Date().toISOString();
		ragJob.controller = undefined;
		ragJob.configuration = undefined;
	}
}
