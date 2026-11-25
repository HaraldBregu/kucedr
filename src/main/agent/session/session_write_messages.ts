import { existsSync } from 'node:fs';
import { readSealed } from '../../vault/read';
import { atomicWriteFile } from './session_atomic_write';
import { parseMessages } from './session_parse_messages';

export function writeMessagesFile(filePath: string, backupPath: string, content: string): void {
	if (existsSync(filePath)) {
		const current = readSealed(filePath);
		if (parseMessages(current) !== undefined) atomicWriteFile(backupPath, current);
	}
	atomicWriteFile(filePath, content);
}
