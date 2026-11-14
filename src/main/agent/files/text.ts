import { isUtf8 } from 'node:buffer';

export function decodeUtf8(content: Buffer, filePath: string): string {
	if (!isUtf8(content)) throw new Error(`File is not UTF-8 text: ${filePath}`);
	return content.toString('utf8');
}
