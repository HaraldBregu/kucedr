import { authorizeFilePath } from '../../files/authorize';
import { fileHistoryTargets } from '../../history/targets';
import { validateFilePath } from '../../files/validate';
import { z } from 'zod';
import { redoFileOperation } from '../../history/redo';
import type { FileHistory } from '../../history/types';
import { tool } from '../tool';

export function redoFileTool(history: FileHistory) {
	return tool({
		id: 'redo',
		name: 'Redo file operation',
		description:
			'Redo the most recently undone file operation in this session. Refuses if a file changed afterward.',
		inputSchema: z.object({}),
		execute: () => {
			for (const target of fileHistoryTargets(history, 'redo')) validateFilePath(authorizeFilePath(target), true);
			const operation = redoFileOperation(history);
			return {
				operationId: operation.id,
				toolName: operation.toolName,
				restored: operation.after.map((file) => file.path),
			};
		},
	});
}
