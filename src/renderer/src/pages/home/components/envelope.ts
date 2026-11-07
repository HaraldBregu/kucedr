export type ParsedEnvelope =
	| { kind: 'complete'; content: string }
	| { kind: 'streaming'; content: string }
	| { kind: 'markdown'; content: string };

/** Reads the last envelope, so a response the host asked to rewrite shows its retry. */
export function parseEnvelope(content: string, tag: string, streaming: boolean): ParsedEnvelope {
	const open = `<${tag}>`;
	const close = `</${tag}>`;
	const trimmed = content.trim();
	const start = trimmed.lastIndexOf(open);
	if (start !== -1) {
		const rest = trimmed.slice(start + open.length);
		const end = rest.indexOf(close);
		if (end !== -1) {
			const body = rest.slice(0, end).trim();
			if (body.length > 0 && !rest.slice(end + close.length).trim())
				return { kind: 'complete', content: body };
		} else if (streaming) {
			let body = rest;
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
	if (streaming && trimmed && open.startsWith(trimmed)) return { kind: 'streaming', content: '' };
	return { kind: 'markdown', content };
}
