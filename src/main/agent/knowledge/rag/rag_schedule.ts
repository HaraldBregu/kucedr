import cron, { type ScheduledTask } from 'node-cron';
import { cancelRagIndexing } from './cancel';
import { ragJob } from './job';
import { runRagIndexing } from './run';
import { getRagConfiguration, subscribeRagConfiguration } from './rag_store';
import { ragIndexingSignature } from './signature';
import type { RagScheduleLogger } from './types';
import { DEFAULT_WORKSPACE } from '../../../../shared/workspaces_types';
import { currentWorkspace } from '../../../workspaces/current';
import { workspaceScope } from '../../../workspaces/scope';
import { withinWorkspace } from '../../../workspaces/within';

const tasks = new Map<string, ScheduledTask>();
let scheduleLogger: RagScheduleLogger | undefined;
let unsubscribe: (() => void) | undefined;
const revisions = new Map<string, number>();
let revision = 0;

export function startRagSchedule(logger: RagScheduleLogger): void {
	unsubscribe?.();
	scheduleLogger = logger;
	unsubscribe = subscribeRagConfiguration(rescheduleRagIndexing);
	withinWorkspace(DEFAULT_WORKSPACE, schedule);
}

export function stopRagSchedule(): void {
	revisions.clear();
	unsubscribe?.();
	unsubscribe = undefined;
	for (const [id, task] of tasks) {
		withinWorkspace(id, cancelRagIndexing);
		task.destroy();
	}
	tasks.clear();
	scheduleLogger = undefined;
}

export function rescheduleRagIndexing(): void {
	const job = ragJob();
	if (job.configuration && job.configuration !== ragIndexingSignature(getRagConfiguration()))
		cancelRagIndexing();
	if (scheduleLogger) withinWorkspace(DEFAULT_WORKSPACE, schedule);
}

export function getRagNextRun(): string | null {
	return tasks.get(DEFAULT_WORKSPACE)?.getNextRun()?.toISOString() ?? null;
}

function schedule(): void {
	const currentRevision = ++revision;
	const workspace = currentWorkspace();
	revisions.set(workspace.id, currentRevision);
	tasks.get(workspace.id)?.destroy();
	tasks.delete(workspace.id);
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
	tasks.set(
		workspace.id,
		cron.schedule(
			configuration.cronExpression,
			() =>
				workspaceScope.run(workspace, async () => {
					if (revisions.get(workspace.id) !== currentRevision || ragJob().running) return;
					try {
						await runRagIndexing('scheduled');
						logger.info('RAG', 'Scheduled indexing completed.');
					} catch (error) {
						logger.error('RAG', 'Scheduled indexing failed.', error);
					}
				}),
			{ noOverlap: true, timezone: configuration.timezone, missedExecutionTolerance: 60_000 }
		)
	);
}
