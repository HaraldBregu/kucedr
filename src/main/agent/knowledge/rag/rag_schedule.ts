import cron, { type ScheduledTask } from 'node-cron';
import { cancelRagIndexing } from './cancel';
import { ragJob } from './job';
import { runRagIndexing } from './run';
import { getRagConfiguration, subscribeRagConfiguration } from './rag_store';
import { ragIndexingSignature } from './signature';
import type { RagScheduleLogger } from './types';

let task: ScheduledTask | undefined;
let scheduleLogger: RagScheduleLogger | undefined;
let unsubscribe: (() => void) | undefined;
let revision = 0;

export function startRagSchedule(logger: RagScheduleLogger): void {
	unsubscribe?.();
	scheduleLogger = logger;
	unsubscribe = subscribeRagConfiguration(rescheduleRagIndexing);
	schedule();
}

export function stopRagSchedule(): void {
	revision += 1;
	unsubscribe?.();
	unsubscribe = undefined;
	cancelRagIndexing();
	task?.destroy();
	task = undefined;
	scheduleLogger = undefined;
}

export function rescheduleRagIndexing(): void {
	if (ragJob.configuration && ragJob.configuration !== ragIndexingSignature(getRagConfiguration()))
		cancelRagIndexing();
	if (scheduleLogger) schedule();
}

export function getRagNextRun(): string | null {
	return task?.getNextRun()?.toISOString() ?? null;
}

function schedule(): void {
	const currentRevision = ++revision;
	task?.destroy();
	task = undefined;
	const logger = scheduleLogger;
	const configuration = getRagConfiguration();
	if (
		!logger ||
		configuration.enabled !== true ||
		!configuration.scheduleEnabled ||
		configuration.folders.length === 0
	)
		return;
	if (!cron.validate(configuration.cronExpression)) {
		logger.error('RAG', `Invalid indexing schedule: ${configuration.cronExpression}`);
		return;
	}
	logger.info(
		'RAG',
		`Indexing ${configuration.folders.length} folder(s) on ${configuration.cronExpression}`
	);
	task = cron.schedule(
		configuration.cronExpression,
		async () => {
			if (currentRevision !== revision || ragJob.running) return;
			try {
				await runRagIndexing('scheduled');
				logger.info('RAG', 'Scheduled indexing completed.');
			} catch (error) {
				logger.error('RAG', 'Scheduled indexing failed.', error);
			}
		},
		{ noOverlap: true, timezone: configuration.timezone, missedExecutionTolerance: 60_000 }
	);
}
