// Receives one { operation, provider, indexName, ... } message and replies with { result } or { error }.
import { Pinecone } from '@pinecone-database/pinecone';
import { discard } from './discard.mjs';
import { purge } from './purge.mjs';
import { upload } from './upload.mjs';

const operations = { upload, discard, purge };

process.parentPort.once('message', async ({ data }) => {
	try {
		const run = operations[data.operation];
		if (!run) throw new Error(`Unknown operation: ${data.operation}`);
		const client = new Pinecone({ apiKey: data.provider.apiKey });
		process.parentPort.postMessage({ result: (await run(client, data)) ?? null });
	} catch (error) {
		process.parentPort.postMessage({
			error: error instanceof Error ? error.message : String(error),
		});
	}
});
