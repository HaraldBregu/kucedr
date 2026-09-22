import { connectA2aAgent } from './connect';
import { sanitizeA2aError } from './error';
import { formatA2aTaskOutcome } from './format';
import { assertA2aPartsSize } from './parts';
import { resolveA2aAgent } from './remote';
import { a2aText } from './text';

export async function cancelA2aTask(
	agentId: string,
	taskId: string,
	signal?: AbortSignal
): Promise<string> {
	const remote = resolveA2aAgent(agentId);
	try {
		const { client } = await connectA2aAgent(remote.url, remote, signal);
		const timeout = AbortSignal.timeout(15_000);
		const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
		const task = await client.cancelTask(
			{ tenant: '', id: taskId, metadata: undefined },
			{ signal: requestSignal }
		);
		const statusParts = task.status?.message?.parts ?? [];
		assertA2aPartsSize(statusParts);
		return formatA2aTaskOutcome(
			task.id,
			task.contextId,
			task.status?.state,
			a2aText(statusParts)
		);
	} catch (error) {
		throw sanitizeA2aError(error, remote);
	}
}
