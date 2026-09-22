import { restoreFiles } from './restore';
import type { FileHistory, FileOperation } from './types';

export function undoFileOperation(history: FileHistory): FileOperation {
	const operation = [...history.operations].reverse().find((candidate) => candidate.state === 'applied');
	if (!operation) throw new Error('There is no file operation to undo.');
	restoreFiles(operation.after, operation.before);
	operation.state = 'undone';
	return operation;
}
