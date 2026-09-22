import { authorizeFilePath } from '../../files/authorize';
import { fileHistoryTargets } from '../../history/targets';
import { validateFilePath } from '../../files/validate';
import { z } from 'zod';
import { undoFileOperation } from '../../history/undo';
import type { FileHistory } from '../../history/types';
import { tool } from '../tool';

export function undoFileTool(history: FileHistory) {
	return tool({
		id: 'undo',
		name: 'Undo file operation',
		description:
			'Undo the most recent write, edit, or patch operation in this session. Refuses if a file changed afterward.',
		inputSchema: z.object({}),
		execute: () => {
			for (const target of fileHistoryTargets(history, 'undo')) validateFilePath(authorizeFilePath(target), true);
			const operation = undoFileOperation(history);
			return {
				operationId: operation.id,
				toolName: operation.toolName,
				restored: operation.before.map((file) => file.path),
			};
		},
	});
}
