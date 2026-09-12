const getRagConfiguration = jest.fn();
const searchRag = jest.fn();

jest.mock('../../../../../src/main/agent/knowledge/rag', () => ({ getRagConfiguration, searchRag }));

import { getKnowledgeTools } from '../../../../../src/main/agent/tools/knowledge';
import { queryKnowledgeTool } from '../../../../../src/main/agent/tools/knowledge/query_knowledge';

beforeEach(() => {
	jest.clearAllMocks();
	getRagConfiguration.mockReturnValue({ enabled: true, indexName: 'company-knowledge' });
});

it('exposes the knowledge tool only when the local index is enabled', () => {
	expect(getKnowledgeTools().map((tool) => tool.id)).toEqual(['query_knowledge']);
	getRagConfiguration.mockReturnValue({ enabled: false, indexName: 'company-knowledge' });
	expect(getKnowledgeTools()).toEqual([]);
});

it('searches the configured local index', async () => {
	const controller = new AbortController();
	searchRag.mockResolvedValue([
		{
			sourceId: 'source-1',
			chunkId: 'source-1#0',
			path: 'handbook/leave.md',
			lineStart: 4,
			lineEnd: 4,
			checksum: 'checksum-1',
			indexedAt: '2026-08-08T00:00:00.000Z',
			text: 'Twenty days.',
			score: 0.91,
		},
	]);

	const output = JSON.parse(
		(await queryKnowledgeTool.run({ query: ' leave ', count: 3 }, controller.signal)) as string
	);

	expect(searchRag).toHaveBeenCalledWith('leave', 'company-knowledge', 3, {
		signal: controller.signal,
	});
	expect(output).toMatchObject({ route: 'rag', abstain: false });
	expect(output.results[0]).toMatchObject({
		kind: 'local_rag',
		sourceId: 'source-1',
		chunkId: 'source-1#0',
		range: { lineStart: 4, lineEnd: 4 },
		status: 'indexed',
	});
});

it('abstains when the local index returns no evidence', async () => {
	searchRag.mockResolvedValue([]);

	const output = JSON.parse((await queryKnowledgeTool.run({ query: 'missing' })) as string);

	expect(output).toMatchObject({ route: 'abstain', abstain: true, results: [] });
	expect(output.limitations).toContain('The local knowledge index returned no matching evidence.');
});
