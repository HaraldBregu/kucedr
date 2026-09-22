import { connectA2aAgent } from './connect';
import { sanitizeA2aError } from './error';
import { formatA2aTaskOutcome } from './format';
import { assertA2aPartsSize } from './parts';
import { resolveA2aAgent } from './remote';
import { a2aText } from './text';

export async function getA2aTask(
	agentId: string,
	taskId: string,
	signal?: AbortSignal
): Promise<string> {
	const remote = resolveA2aAgent(agentId);
	try {
		const { client } = await connectA2aAgent(remote.url, remote, signal);
		const task = await client.getTask(
			{ tenant: '', id: taskId, historyLength: 0 },
			{ signal }
		);
		let receivedBytes = 0;
		for (const artifact of task.artifacts) {
			receivedBytes = assertA2aPartsSize(artifact.parts, receivedBytes);
		}
		const statusParts = task.status?.message?.parts ?? [];
		assertA2aPartsSize(statusParts, receivedBytes);
		const artifactText = a2aText(task.artifacts.flatMap((artifact) => artifact.parts));
		const statusText = a2aText(statusParts);
		return formatA2aTaskOutcome(
			task.id,
			task.contextId,
			task.status?.state,
			artifactText || statusText
		);
	} catch (error) {
		throw sanitizeA2aError(error, remote);
	}
}
