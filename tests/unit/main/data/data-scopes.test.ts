const close = jest.fn();
const getIndex = jest.fn(() => ({
	indexName: 'knowledge-base',
	generation: 'kucedr-11111111-1111-4111-8111-111111111111',
}));
const ragVectorStore = jest.fn(() => ({ getIndex, close }));
const getRagConfiguration = jest.fn(() => ({
	indexName: 'knowledge-base',
}));

jest.mock('../../../../src/main/agent/knowledge/rag/vector', () => ({ ragVectorStore }));
jest.mock('../../../../src/main/agent/knowledge/rag/rag_store', () => ({ getRagConfiguration }));

import { DataController } from '../../../../src/main/data/data_controller';

it('discovers full local, active local, and remote Kucedr namespace scopes separately', () => {
	const controller = new DataController({
		config: { location: '/workspace' },
		listSessions: () => [
			{
				id: '11111111-1111-4111-8111-111111111111',
				title: 'Session',
				createdAtMs: 1,
			},
		],
		deleteSession: jest.fn(),
	});

	expect(controller.listScopes()).toEqual([
		{ kind: 'memory' },
		{ kind: 'sessions', sessionIds: ['11111111-1111-4111-8111-111111111111'] },
		{ kind: 'rag', mode: 'local_index', indexName: 'knowledge-base' },
		{
			kind: 'rag',
			mode: 'local_namespace',
			indexName: 'knowledge-base',
			generation: 'kucedr-11111111-1111-4111-8111-111111111111',
		},
		{
			kind: 'rag',
			mode: 'remote_namespace',
			indexName: 'knowledge-base',
			generation: 'kucedr-11111111-1111-4111-8111-111111111111',
		},
		{
			kind: 'rag',
			mode: 'remote_all_namespaces',
			indexName: 'knowledge-base',
		},
	]);
	expect(close).toHaveBeenCalled();
});
