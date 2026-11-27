import { LINE_PREFIX } from './seal_line';
import { unseal } from './unseal';

export function unsealLine(line: string): string {
	return line.startsWith(LINE_PREFIX)
		? unseal(Buffer.from(line.slice(LINE_PREFIX.length), 'base64')).toString('utf8')
		: line;
}
