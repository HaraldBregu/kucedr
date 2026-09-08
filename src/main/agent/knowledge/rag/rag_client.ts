import { Pinecone } from '@pinecone-database/pinecone';
import { ragDatabaseKey } from './database';
import { getRagConfiguration } from './rag_store';

export function ragClient(
	signal?: AbortSignal,
	apiKey = ragDatabaseKey(getRagConfiguration())
): Pinecone {
	return new Pinecone({
		apiKey,
		...(signal ? { fetchApi: (input, init) => fetch(input, { ...init, signal }) } : {}),
	});
}
