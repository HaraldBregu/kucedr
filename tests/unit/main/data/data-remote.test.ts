const purge = jest.fn();
const selectedVectorDatabaseConnection = jest.fn(() => ({
	apiKey: 'synthetic-mirror-account',
	adapter: { purge },
}));

jest.mock('../../../../src/main/database/vector_connection', () => ({
	selectedVectorDatabaseConnection,
}));

import { DataController } from '../../../../src/main/data/data_controller';

beforeEach(() => jest.clearAllMocks());

it('purges an explicitly scoped remote namespace through the selected adapter', async () => {
	const controller = new DataController({
		config: { location: '/workspace' },
		listSessions: () => [],
		deleteSession: jest.fn(),
	});
	const scope = {
		kind: 'rag' as const,
		mode: 'remote_namespace' as const,
		indexName: 'knowledge-base',
		generation: 'kucedr-11111111-1111-4111-8111-111111111111',
	};
	const preview = await controller.previewPurge(scope);

	expect(preview.remoteDataIncluded).toBe(true);
	await expect(controller.export(scope, '/tmp/export.json')).rejects.toThrow(
		'Remote namespaces cannot be exported'
	);
	await expect(controller.purge(scope, preview.confirmationId)).resolves.toEqual(
		expect.objectContaining({ remoteDataDeleted: true })
	);
	expect(purge).toHaveBeenCalledWith('synthetic-mirror-account', 'knowledge-base', scope.generation);
});

it('delegates all Kucedr namespace cleanup to the selected adapter', async () => {
	purge.mockResolvedValue(2);
	const controller = new DataController({
		config: { location: '/workspace' },
		listSessions: () => [],
		deleteSession: jest.fn(),
	});
	const scope = { kind: 'rag' as const, mode: 'remote_all_namespaces' as const, indexName: 'knowledge-base' };
	const preview = await controller.previewPurge(scope);
	await expect(controller.purge(scope, preview.confirmationId)).resolves.toMatchObject({
		remoteDataDeleted: true,
		remoteNamespacesDeleted: 2,
	});
	expect(purge).toHaveBeenCalledWith('synthetic-mirror-account', 'knowledge-base', undefined);
});
