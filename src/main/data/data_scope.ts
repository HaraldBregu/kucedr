import { normalizeRagIndexName } from '../agent/knowledge/rag/rag_index_name';
import { requireUuidSessionId } from '../agent/session';
import type { DataScope } from '../../shared/data_types';

export function normalizeDataScope(value: unknown): DataScope {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error('Invalid data scope.');
	}
	const input = value as Record<string, unknown>;
	if (input.kind === 'memory') return { kind: 'memory' };
	if (input.kind === 'sessions') {
		if (!Array.isArray(input.sessionIds) || input.sessionIds.length === 0) {
			throw new Error('Select at least one assistant session.');
		}
		const sessionIds = [
			...new Set(input.sessionIds.map((sessionId) => requireUuidSessionId(sessionId))),
		];
		if (sessionIds.length > 500) throw new Error('Select no more than 500 assistant sessions.');
		return { kind: 'sessions', sessionIds };
	}
	if (input.kind === 'rag') {
		if (typeof input.indexName !== 'string') throw new Error('A RAG index name is required.');
		const indexName = normalizeRagIndexName(input.indexName);
		if (input.mode === 'local_index') return { kind: 'rag', mode: 'local_index', indexName };
		if (input.mode === 'remote_all_namespaces') {
			return { kind: 'rag', mode: 'remote_all_namespaces', indexName };
		}
		if (
			(input.mode === 'local_namespace' || input.mode === 'remote_namespace') &&
			typeof input.generation === 'string' &&
			/^kucedr-[0-9a-f-]{36}$/i.test(input.generation)
		) {
			return {
				kind: 'rag',
				mode: input.mode,
				indexName,
				generation: input.generation.toLowerCase(),
			};
		}
	}
	throw new Error('Invalid data scope.');
}
