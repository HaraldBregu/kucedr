const OPEN = '<proposed_plan>';
const CLOSE = '</proposed_plan>';

export type ParsedPlan =
	| { kind: 'complete'; content: string }
	| { kind: 'streaming'; content: string }
	| { kind: 'markdown'; content: string };

export function parsePlanEnvelope(content: string, streaming: boolean): ParsedPlan {
	const trimmed = content.trim();
	const openCount = trimmed.split(OPEN).length - 1;
	const closeCount = trimmed.split(CLOSE).length - 1;
	if (
		openCount === 1 &&
		closeCount === 1 &&
		trimmed.startsWith(OPEN) &&
		trimmed.endsWith(CLOSE)
	) {
		const body = trimmed.slice(OPEN.length, -CLOSE.length).trim();
		if (body.length > 0 && !body.includes(OPEN) && !body.includes(CLOSE))
			return { kind: 'complete', content: body };
	}
	if (streaming) {
		if (OPEN.startsWith(trimmed)) return { kind: 'streaming', content: '' };
		if (trimmed.startsWith(OPEN) && closeCount === 0) {
			let body = trimmed.slice(OPEN.length);
			for (let length = CLOSE.length - 1; length > 0; length--) {
				const partial = CLOSE.slice(0, length);
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
