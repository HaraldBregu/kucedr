import { mkdtemp, mkdir, realpath, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { RagConfiguration } from '../../../../src/shared/rag_types';

const getRagConfiguration = jest.fn();
const embed = jest.fn();
jest.mock('../../../../src/main/agent/knowledge/rag/rag_store', () => ({ getRagConfiguration }));
jest.mock('../../../../src/main/agent/knowledge/rag/recipient', () => ({
	ragRecipient: () => 'fixture-recipient',
}));
jest.mock('../../../../src/main/settings_store', () => ({ getProvider: jest.fn() }));
jest.mock('../../../../src/main/agent/knowledge/rag/embedding', () => ({
	SelectedEmbeddingProvider: jest.fn(() => ({ embed })),
}));

import { indexRag } from '../../../../src/main/agent/knowledge/rag/rag_index';
import { queryKnowledgeTool } from '../../../../src/main/agent/tools/knowledge/query_knowledge';

it('indexes local files and serves evidence through Query knowledge across persisted generations', async () => {
	const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'kucedr-knowledge-pipeline-')));
	const sources = path.join(root, 'sources');
	const previousRoot = process.env.KUCEDR_E2E_DATA_ROOT;
	process.env.KUCEDR_E2E_DATA_ROOT = root;
	const configuration: RagConfiguration = {
		enabled: true,
		indexName: 'fixture',
		databaseProviderId: 'local',
		databaseId: 'sqlite',
		embeddingProviderId: 'openai',
		embeddingModelId: 'fixture-model',
		embeddingConsent: {
			providerId: 'openai',
			modelId: 'fixture-model',
			version: 1,
			recipient: 'fixture-recipient',
		},
		mirrorConsent: null,
		folders: [sources],
		scheduleEnabled: false,
		cronExpression: '0 3 * * *',
	};
	getRagConfiguration.mockImplementation(() => ({
		...configuration,
		folders: [...configuration.folders],
	}));
	embed.mockImplementation(async (input) => ({
		providerId: input.providerId,
		modelId: input.modelId,
		dimensions: 2,
		embeddings: input.texts.map((text: string) =>
			text.toLowerCase().includes('refund') ? [1, 0] : [0, 1]
		),
	}));
	try {
		await mkdir(sources);
		await writeFile(
			path.join(sources, 'refunds.md'),
			'# Refunds\n\nRequest a refund within thirty days.'
		);
		await writeFile(path.join(sources, 'delivery.md'), '# Delivery\n\nOrders arrive in five days.');
		await expect(indexRag([sources], 'fixture')).resolves.toEqual({ files: 2, vectors: 2 });
		await expect(indexRag([sources], 'fixture')).resolves.toEqual({ files: 2, vectors: 2 });
		expect(embed).toHaveBeenCalledTimes(2);
		const evidence = JSON.parse(
			(await queryKnowledgeTool.run({ query: 'refund policy', count: 3 })) as string
		);
		expect(evidence).toMatchObject({ route: 'rag', abstain: false });
		expect(evidence.results).toEqual([
			expect.objectContaining({
				path: 'sources/refunds.md',
				range: { lineStart: 1, lineEnd: 3 },
				excerpt: '# Refunds\n\nRequest a refund within thirty days.',
			}),
		]);
		await rm(path.join(sources, 'refunds.md'));
		await indexRag([sources], 'fixture');
		const removed = JSON.parse(
			(await queryKnowledgeTool.run({ query: 'refund policy' })) as string
		);
		expect(removed).toMatchObject({ route: 'abstain', abstain: true, results: [] });
		await rm(path.join(sources, 'delivery.md'));
		await expect(indexRag([sources], 'fixture')).resolves.toEqual({ files: 0, vectors: 0 });
		const requests = embed.mock.calls.length;
		expect(
			JSON.parse((await queryKnowledgeTool.run({ query: 'refund policy' })) as string)
		).toMatchObject({ route: 'abstain', results: [] });
		expect(embed).toHaveBeenCalledTimes(requests);
	} finally {
		if (previousRoot === undefined) delete process.env.KUCEDR_E2E_DATA_ROOT;
		else process.env.KUCEDR_E2E_DATA_ROOT = previousRoot;
		await rm(root, { recursive: true, force: true });
	}
});
