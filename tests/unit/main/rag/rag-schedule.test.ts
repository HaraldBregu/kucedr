const schedule = jest.fn();
const validate = jest.fn();
const destroy = jest.fn();
const getRagConfiguration = jest.fn();
const indexRag = jest.fn();
const subscribeRagConfiguration = jest.fn();
const unsubscribe = jest.fn();
const getNextRun = jest.fn();
const getIndex = jest.fn();
const close = jest.fn();

jest.mock('node-cron', () => ({
	__esModule: true,
	default: { schedule, validate },
}));

jest.mock('../../../../src/main/agent/knowledge/rag/rag_store', () => ({
	getRagConfiguration,
	subscribeRagConfiguration,
}));
jest.mock('../../../../src/main/agent/knowledge/rag/rag_index', () => ({ indexRag }));
jest.mock('../../../../src/main/agent/knowledge/rag/vector', () => ({
	ragVectorStore: () => ({ getIndex, close }),
}));

import {
	rescheduleRagIndexing,
	startRagSchedule,
	stopRagSchedule,
} from '../../../../src/main/agent/knowledge/rag/rag_schedule';
import { runRagIndexing } from '../../../../src/main/agent/knowledge/rag/run';
import { cancelRagIndexing } from '../../../../src/main/agent/knowledge/rag/cancel';
import { getRagStatus } from '../../../../src/main/agent/knowledge/rag/status';

describe('RAG indexing schedule', () => {
	const logger = { info: jest.fn(), error: jest.fn() };
	const configuration = {
		enabled: true,
		indexName: 'knowledge-base',
		databaseProviderId: 'pinecone',
		databaseId: 'pinecone',
		embeddingProviderId: 'openai',
		embeddingModelId: 'text-embedding-3-small',
		folders: ['/documents'],
		scheduleEnabled: true,
		cronExpression: '0 3 * * *',
		timezone: 'Europe/Rome',
	};

	beforeEach(() => {
		stopRagSchedule();
		jest.clearAllMocks();
		schedule.mockReturnValue({ destroy, getNextRun });
		validate.mockReturnValue(true);
		subscribeRagConfiguration.mockReturnValue(unsubscribe);
		getNextRun.mockReturnValue(new Date('2026-10-09T01:00:00.000Z'));
		getRagConfiguration.mockReturnValue(configuration);
		indexRag.mockResolvedValue({ files: 1, vectors: 2 });
	});

	afterEach(() => stopRagSchedule());

	it('runs indexing for configured folders on the configured cron schedule', async () => {
		startRagSchedule(logger);

		expect(schedule).toHaveBeenCalledWith('0 3 * * *', expect.any(Function), {
			noOverlap: true,
			timezone: 'Europe/Rome',
			missedExecutionTolerance: 60_000,
		});
		await schedule.mock.calls[0][1]();
		expect(indexRag).toHaveBeenCalledWith(['/documents'], 'knowledge-base', {
			signal: expect.any(AbortSignal),
		});
		expect(logger.info).toHaveBeenCalledWith('RAG', 'Scheduled indexing completed.');
	});

	it('replaces the scheduled task when the configuration changes', () => {
		startRagSchedule(logger);
		rescheduleRagIndexing();

		expect(destroy).toHaveBeenCalledTimes(1);
		expect(schedule).toHaveBeenCalledTimes(2);
	});

	it('does not schedule invalid cron expressions', () => {
		validate.mockReturnValue(false);
		startRagSchedule(logger);

		expect(schedule).not.toHaveBeenCalled();
		expect(logger.error).toHaveBeenCalledWith('RAG', 'Invalid indexing schedule: 0 3 * * *');
	});

	it('does not schedule while Knowledge is disabled', () => {
		getRagConfiguration.mockReturnValue({ ...configuration, enabled: false });
		startRagSchedule(logger);

		expect(schedule).not.toHaveBeenCalled();
	});

	it('skips a scheduled run while manual indexing owns the job', async () => {
		let complete!: (result: { files: number; vectors: number }) => void;
		indexRag.mockImplementation(() => new Promise((resolve) => { complete = resolve; }));
		startRagSchedule(logger);
		const manual = runRagIndexing();
		await schedule.mock.calls[0][1]();
		await expect(runRagIndexing()).rejects.toThrow('already running');
		expect(indexRag).toHaveBeenCalledTimes(1);
		expect(getRagStatus()).toMatchObject({ running: true, trigger: 'manual', outcome: 'running' });
		complete({ files: 1, vectors: 2 });
		await manual;
		expect(getRagStatus()).toMatchObject({
			running: false,
			outcome: 'completed',
			result: { files: 1, vectors: 2 },
		});
	});

	it('keeps the job locked until cancellation finishes', async () => {
		let reject!: (error: Error) => void;
		indexRag.mockImplementation(() => new Promise((_resolve, rejectRun) => { reject = rejectRun; }));
		const manual = runRagIndexing();
		cancelRagIndexing();
		const signal = indexRag.mock.calls[0][2].signal;
		expect(signal.aborted).toBe(true);
		await expect(runRagIndexing()).rejects.toThrow('already running');
		reject(signal.reason);
		await expect(manual).rejects.toThrow('cancelled');
		expect(getRagStatus()).toMatchObject({ running: false, outcome: 'cancelled' });
	});

	it('cancels indexing when the embedding model or source settings change', async () => {
		indexRag.mockImplementation((_folders, _indexName, { signal }) => new Promise((_resolve, reject) => {
			signal.addEventListener('abort', () => reject(signal.reason), { once: true });
		}));
		startRagSchedule(logger);
		const manual = runRagIndexing();
		getRagConfiguration.mockReturnValue({ ...configuration, embeddingModelId: 'changed-model' });
		subscribeRagConfiguration.mock.calls[0][0]();
		await expect(manual).rejects.toThrow('cancelled');
		expect(getRagStatus()).toMatchObject({ running: false, outcome: 'cancelled' });
	});

	it('preserves manual indexing when only its schedule or retrieval threshold changes', async () => {
		let complete!: (result: { files: number; vectors: number }) => void;
		indexRag.mockImplementation(() => new Promise((resolve) => { complete = resolve; }));
		startRagSchedule(logger);
		const manual = runRagIndexing();
		getRagConfiguration.mockReturnValue({ ...configuration, cronExpression: '0 4 * * *', minimumScore: 0.2 });
		subscribeRagConfiguration.mock.calls[0][0]();
		expect(indexRag.mock.calls[0][2].signal.aborted).toBe(false);
		complete({ files: 1, vectors: 2 });
		await manual;
	});

	it('does not execute obsolete or stopped schedule callbacks', async () => {
		startRagSchedule(logger);
		const callback = schedule.mock.calls[0][1];
		rescheduleRagIndexing();
		await callback();
		const current = schedule.mock.calls[1][1];
		stopRagSchedule();
		await current();
		expect(indexRag).not.toHaveBeenCalled();
		expect(unsubscribe).toHaveBeenCalledTimes(1);
	});

	it('reports selected local index metadata and the next timezone-aware run without exporting records', () => {
		startRagSchedule(logger);
		getIndex.mockReturnValue({
			indexName: 'knowledge-base',
			generation: 'private-generation',
			providerId: 'openai',
			modelId: 'text-embedding-3-small',
			dimensions: 1536,
			completedAt: '2026-10-08T01:00:00.000Z',
		});
		const status = getRagStatus();
		expect(status).toMatchObject({
			nextRunAt: '2026-10-09T01:00:00.000Z',
			timezone: 'Europe/Rome',
			index: { indexName: 'knowledge-base', dimensions: 1536, modelId: 'text-embedding-3-small' },
		});
		expect(status.index).not.toHaveProperty('generation');
		expect(getIndex).toHaveBeenCalledWith('knowledge-base');
		expect(close).toHaveBeenCalled();
	});

	it('records a failed run and lets the next indexing job retry', async () => {
		indexRag.mockRejectedValueOnce(new Error('Embedding endpoint unavailable'));
		await expect(runRagIndexing()).rejects.toThrow('Embedding endpoint unavailable');
		expect(getRagStatus()).toMatchObject({ running: false, outcome: 'failed', error: 'Embedding endpoint unavailable' });
		await expect(runRagIndexing()).resolves.toEqual({ files: 1, vectors: 2 });
	});
});
