const schedule = jest.fn();
const validate = jest.fn();
const destroy = jest.fn();
const getRagConfiguration = jest.fn();
const indexRag = jest.fn();

jest.mock('node-cron', () => ({
	__esModule: true,
	default: { schedule, validate },
}));

jest.mock('../../../../src/main/agent/knowledge/rag/rag_store', () => ({ getRagConfiguration }));
jest.mock('../../../../src/main/agent/knowledge/rag/rag_index', () => ({ indexRag }));

import {
	rescheduleRagIndexing,
	startRagSchedule,
	stopRagSchedule,
} from '../../../../src/main/agent/knowledge/rag/rag_schedule';

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
	};

	beforeEach(() => {
		stopRagSchedule();
		jest.clearAllMocks();
		schedule.mockReturnValue({ destroy });
		validate.mockReturnValue(true);
		getRagConfiguration.mockReturnValue(configuration);
		indexRag.mockResolvedValue({ files: 1, vectors: 2 });
	});

	afterEach(() => stopRagSchedule());

	it('runs indexing for configured folders on the configured cron schedule', async () => {
		startRagSchedule(logger);

		expect(schedule).toHaveBeenCalledWith('0 3 * * *', expect.any(Function), { noOverlap: true });
		await schedule.mock.calls[0][1]();
		expect(indexRag).toHaveBeenCalledWith(['/documents'], 'knowledge-base');
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
});
