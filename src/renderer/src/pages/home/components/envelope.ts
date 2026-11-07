export type ParsedEnvelope =
	| { kind: 'complete'; content: string }
	| { kind: 'streaming'; content: string }
	| { kind: 'markdown'; content: string };

export function parseEnvelope(content: string, tag: string, streaming: boolean): ParsedEnvelope {
	const open = `<${tag}>`;
	const close = `</${tag}>`;
	const trimmed = content.trim();
	const openCount = trimmed.split(open).length - 1;
	const closeCount = trimmed.split(close).length - 1;
	if (
		openCount === 1 &&
		closeCount === 1 &&
		trimmed.startsWith(open) &&
		trimmed.endsWith(close)
	) {
		const body = trimmed.slice(open.length, -close.length).trim();
		if (body.length > 0 && !body.includes(open) && !body.includes(close))
			return { kind: 'complete', content: body };
	}
	if (streaming) {
		if (trimmed && open.startsWith(trimmed)) return { kind: 'streaming', content: '' };
		if (trimmed.startsWith(open) && closeCount === 0) {
			let body = trimmed.slice(open.length);
			for (let length = close.length - 1; length > 0; length--) {
				const partial = close.slice(0, length);
				if (body.endsWith(partial)) {
					body = body.slice(0, -partial.length);
					break;
				}
			}
			return { kind: 'streaming', content: body.trim() };
		}
	}
	return { kind: 'markdown', content };
}
