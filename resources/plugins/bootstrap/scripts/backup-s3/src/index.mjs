// Receives one { operation, provider, roots, protectedRoot } message and replies with { result } or { error }.
import { createClient } from './client.mjs';
import { describe } from './describe.mjs';
import { pull } from './pull.mjs';
import { push } from './push.mjs';

process.parentPort.once('message', async ({ data }) => {
	const client = createClient(data.provider);
	try {
		const run = data.operation === 'backup' ? push : pull;
		process.parentPort.postMessage({ result: await run(client, data) });
	} catch (error) {
		process.parentPort.postMessage({ error: describe(error) });
	} finally {
		client.destroy();
	}
});
