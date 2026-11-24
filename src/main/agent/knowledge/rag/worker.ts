import { parentPort, workerData } from 'node:worker_threads';
import { SqliteVectorStore } from './sqlite';

const store = new SqliteVectorStore(workerData as string);

parentPort?.on(
	'message',
	({
		id,
		indexName,
		vector,
		topK,
	}: {
		id: number;
		indexName: string;
		vector?: number[];
		topK: number;
	}) => {
		try {
			if (!vector) store.warm(indexName);
			parentPort?.postMessage({ id, hits: vector ? store.search(indexName, vector, topK) : [] });
		} catch (error) {
			parentPort?.postMessage({
				id,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}
);
