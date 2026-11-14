export function lineEnding(content: string): '\r\n' | '\n' {
	return content.includes('\r\n') && !/(^|[^\r])\n/.test(content) ? '\r\n' : '\n';
}
