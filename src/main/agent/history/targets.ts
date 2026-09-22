import type { FileHistory } from './types';

export function fileHistoryTargets(history: FileHistory, direction: 'undo' | 'redo'): string[] {
	const operation = direction === 'undo'
		? [...history.operations].reverse().find((candidate) => candidate.state === 'applied')
		: history.operations.find((candidate) => candidate.state === 'undone');
	if (!operation) return [];
	return [...new Set([...operation.before, ...operation.after].map((snapshot) => snapshot.path))];
}
