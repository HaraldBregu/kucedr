import { normalizeDataScope } from '../../../../src/main/data/data_scope';

it('normalizes exact local RAG and session scopes', () => {
	expect(
		normalizeDataScope({ kind: 'rag', mode: 'local_index', indexName: ' knowledge-base ' })
	).toEqual({ kind: 'rag', mode: 'local_index', indexName: 'knowledge-base' });
	expect(
		normalizeDataScope({
			kind: 'rag',
			mode: 'local_namespace',
			indexName: 'knowledge-base',
			generation: 'kucedr-11111111-1111-4111-8111-111111111111',
		})
	).toEqual({
		kind: 'rag',
		mode: 'local_namespace',
		indexName: 'knowledge-base',
		generation: 'kucedr-11111111-1111-4111-8111-111111111111',
	});
	expect(
		normalizeDataScope({
			kind: 'rag',
			mode: 'remote_namespace',
			indexName: 'knowledge-base',
			generation: 'kucedr-11111111-1111-4111-8111-111111111111',
		})
	).toEqual({
		kind: 'rag',
		mode: 'remote_namespace',
		indexName: 'knowledge-base',
		generation: 'kucedr-11111111-1111-4111-8111-111111111111',
	});
	expect(
		normalizeDataScope({
			kind: 'rag',
			mode: 'remote_all_namespaces',
			indexName: 'knowledge-base',
		})
	).toEqual({ kind: 'rag', mode: 'remote_all_namespaces', indexName: 'knowledge-base' });
	expect(
		normalizeDataScope({
			kind: 'sessions',
			sessionIds: ['11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111'],
		})
	).toEqual({ kind: 'sessions', sessionIds: ['11111111-1111-4111-8111-111111111111'] });
});

it('rejects broad, malformed, and unconfigured scopes', () => {
	expect(() => normalizeDataScope({ kind: 'sessions', sessionIds: [] })).toThrow(
		'Select at least one assistant session.'
	);
	expect(() =>
		normalizeDataScope({
			kind: 'sessions',
			sessionIds: ['..'],
		})
	).toThrow('Invalid assistant session id.');
	expect(() =>
		normalizeDataScope({
			kind: 'rag',
			mode: 'local_namespace',
			indexName: 'kucedr',
			generation: '..',
		})
	).toThrow('Invalid data scope.');
});
