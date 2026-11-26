import type { RagIndexTrigger } from '../../../../shared/rag_status';
import { indexRag } from './rag_index';
import { getRagConfiguration } from './rag_store';
import { ragJob } from './job';
import { ragIndexingSignature } from './signature';
import type { RagIndexResult } from './types';

export async function runRagIndexing(trigger: RagIndexTrigger = 'manual'): Promise<RagIndexResult> {
	const job = ragJob();
	if (job.running) throw new Error('Knowledge indexing is already running.');
	const configuration = getRagConfiguration();
	if (configuration.enabled !== true) throw new Error('Knowledge is disabled.');
	const controller = new AbortController();
	Object.assign(job, {
		running: true,
		trigger,
		startedAt: new Date().toISOString(),
		finishedAt: null,
		outcome: 'running',
		error: null,
		result: null,
		progress: null,
		controller,
		configuration: ragIndexingSignature(configuration),
	});
	try {
		const result = await indexRag(configuration.folders, configuration.indexName, {
			signal: controller.signal,
			progress: (done, total) => {
				job.progress = { done, total };
			},
		});
		controller.signal.throwIfAborted();
		job.result = result;
		job.outcome = 'completed';
		return result;
	} catch (error) {
		job.outcome = controller.signal.aborted ? 'cancelled' : 'failed';
		job.error = error instanceof Error ? error.message : String(error);
		throw error;
	} finally {
		job.running = false;
		job.progress = null;
		job.finishedAt = new Date().toISOString();
		job.controller = undefined;
		job.configuration = undefined;
	}
}
