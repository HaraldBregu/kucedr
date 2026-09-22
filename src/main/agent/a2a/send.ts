import { randomUUID } from 'node:crypto';
import { Role, TaskState, type Message, type Task } from '@a2a-js/sdk';
import { connectA2aAgent } from './connect';
import { sanitizeA2aError } from './error';
import { a2aTaskOutcome } from './outcome';
import { assertA2aPartsSize } from './parts';
import { resolveA2aAgent } from './remote';
import { a2aText } from './text';

export async function sendA2aMessage(
	agentId: string,
	prompt: string,
	signal?: AbortSignal,
	taskId = '',
	contextId = ''
): Promise<string> {
	const remote = resolveA2aAgent(agentId);
	const { card, client } = await connectA2aAgent(remote.url, remote, signal);
	const request = {
		tenant: '',
		message: {
			messageId: randomUUID(),
			contextId,
			taskId,
			role: Role.ROLE_USER,
			parts: [
				{
					content: { $case: 'text' as const, value: prompt },
					metadata: undefined,
					filename: '',
					mediaType: 'text/plain',
				},
			],
			metadata: undefined,
			extensions: [],
			referenceTaskIds: [],
		},
		configuration: {
			acceptedOutputModes: card.defaultOutputModes.filter(
				(mode) => mode === 'text/plain' || mode === 'application/json'
			),
			taskPushNotificationConfig: undefined,
			returnImmediately: false,
		},
		metadata: undefined,
	};
	const options = {
		signal,
	};
	if (card.capabilities?.streaming) {
		const messages: string[] = [];
		const artifacts = new Map<string, string>();
		let remoteTaskId = taskId;
		let remoteContextId = contextId;
		let state: TaskState | undefined;
		let statusText = '';
		let receivedBytes = 0;
		let directMessage = false;
		try {
			for await (const event of client.sendMessageStream(request, options)) {
				const payload = event.payload;
				if (payload?.$case === 'task') {
					remoteTaskId = payload.value.id;
					remoteContextId = payload.value.contextId;
					state = payload.value.status?.state;
					const statusParts = payload.value.status?.message?.parts ?? [];
					receivedBytes = assertA2aPartsSize(statusParts, receivedBytes);
					statusText = a2aText(statusParts);
					for (const artifact of payload.value.artifacts) {
						receivedBytes = assertA2aPartsSize(artifact.parts, receivedBytes);
						artifacts.set(artifact.artifactId, a2aText(artifact.parts));
					}
				}
				if (payload?.$case === 'message') {
					directMessage = true;
					receivedBytes = assertA2aPartsSize(payload.value.parts, receivedBytes);
					messages.push(a2aText(payload.value.parts));
				}
				if (payload?.$case === 'artifactUpdate' && payload.value.artifact) {
					remoteTaskId = payload.value.taskId;
					remoteContextId = payload.value.contextId;
					receivedBytes = assertA2aPartsSize(payload.value.artifact.parts, receivedBytes);
					const text = a2aText(payload.value.artifact.parts);
					const previous = artifacts.get(payload.value.artifact.artifactId) ?? '';
					artifacts.set(
						payload.value.artifact.artifactId,
						payload.value.append ? previous + text : text
					);
				}
				if (payload?.$case === 'statusUpdate' && payload.value.status?.message) {
					remoteTaskId = payload.value.taskId;
					remoteContextId = payload.value.contextId;
					state = payload.value.status.state;
					receivedBytes = assertA2aPartsSize(payload.value.status.message.parts, receivedBytes);
					statusText = a2aText(payload.value.status.message.parts);
				}
				if (
					payload?.$case === 'statusUpdate' &&
					payload.value.status &&
					!payload.value.status.message
				) {
					remoteTaskId = payload.value.taskId;
					remoteContextId = payload.value.contextId;
					state = payload.value.status.state;
				}
			}
		} catch (error) {
			if (signal?.aborted && remoteTaskId) {
				try {
					await client.cancelTask(
						{ tenant: '', id: remoteTaskId, metadata: undefined },
						{ signal: AbortSignal.timeout(5_000) }
					);
					} catch {
						void 0;
					}
			}
			throw sanitizeA2aError(error, remote);
		}
		const artifactText = [...artifacts.values()].filter(Boolean).join('\n');
		const messageText = messages.filter(Boolean).join('\n');
		if (directMessage && !remoteTaskId && state === undefined) {
			return messageText || 'Remote agent returned an empty message.';
		}
		const failed =
			state === TaskState.TASK_STATE_FAILED ||
			state === TaskState.TASK_STATE_CANCELED ||
			state === TaskState.TASK_STATE_REJECTED;
		try {
			return a2aTaskOutcome(
				remoteTaskId,
				remoteContextId,
				state,
				failed
					? statusText || artifactText || messageText
					: artifactText || messageText || statusText
			);
		} catch (error) {
			throw sanitizeA2aError(error, remote);
		}
	}
	try {
		const result = await client.sendMessage(request, options);
		if ('parts' in result) {
			assertA2aPartsSize((result as Message).parts);
			return a2aText((result as Message).parts) || 'Remote agent returned an empty message.';
		}
		const task = result as Task;
		let receivedBytes = 0;
		for (const artifact of task.artifacts) {
			receivedBytes = assertA2aPartsSize(artifact.parts, receivedBytes);
		}
		const statusParts = task.status?.message?.parts ?? [];
		assertA2aPartsSize(statusParts, receivedBytes);
		const artifacts = task.artifacts.flatMap((artifact) => artifact.parts);
		const artifactText = a2aText(artifacts);
		const statusText = a2aText(statusParts);
		const state = task.status?.state;
		const failed =
			state === TaskState.TASK_STATE_FAILED ||
			state === TaskState.TASK_STATE_CANCELED ||
			state === TaskState.TASK_STATE_REJECTED;
		return a2aTaskOutcome(
			task.id,
			task.contextId,
			state,
			failed ? statusText || artifactText : artifactText || statusText
		);
	} catch (error) {
		if (signal?.aborted && taskId) {
			try {
				await client.cancelTask(
					{ tenant: '', id: taskId, metadata: undefined },
					{ signal: AbortSignal.timeout(5_000) }
				);
			} catch {
				void 0;
			}
		}
		throw sanitizeA2aError(error, remote);
	}
}
