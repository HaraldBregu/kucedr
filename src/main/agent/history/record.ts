import crypto from 'node:crypto';
import type { FileHistory, FileSnapshot } from './types';

export function recordFileOperation(
	history: FileHistory,
	runId: string,
	toolCallId: string,
	toolName: string,
	before: FileSnapshot[],
	after: FileSnapshot[]
): void {
	history.operations = history.operations.filter((operation) => operation.state !== 'undone');
	history.operations.push({
		id: crypto.randomUUID(),
		runId,
		toolCallId,
		toolName,
		createdAt: new Date().toISOString(),
		before,
		after,
		state: 'applied',
	});
	history.operations = history.operations.slice(-100);
	let retainedBytes = 0;
	let first = history.operations.length;
	while (first > 0) {
		const operation = history.operations[first - 1];
		retainedBytes += [...operation.before, ...operation.after].reduce((total, snapshot) => total + (snapshot.content?.length ?? 0), 0);
		if (retainedBytes > 16 * 1024 * 1024) break;
		first -= 1;
	}
	history.operations = history.operations.slice(first);
}
