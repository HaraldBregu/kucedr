import { persist } from './session_persist';
import type { SessionState } from './session_types';
import type { Message } from '../types';

const DEDUPED_SECTIONS = ['## Agent filesystem'];
const SECTION_BREAK = /\n\n(?=## )/;

function internal(message: Message | undefined): boolean {
	return (
		Array.isArray(message?.content) &&
		message.content.length > 0 &&
		message.content.every((block) => block.internal === true)
	);
}

function runContextText(message: Message | undefined): string | undefined {
	if (!internal(message) || !Array.isArray(message?.content)) return undefined;
	const block = message.content.find((candidate) => candidate.runContext === true);
	return typeof block?.text === 'string' ? block.text : undefined;
}

function unchanged(header: string): string {
	return `${header}\nUnchanged since the previous run context.`;
}

export function addRunContext(state: SessionState, context: string): void {
	if (!context || (state.lease && !state.lease.active)) return;
	let index = state.messages.findLastIndex(
		(message) => message.role === 'user' && !internal(message)
	);
	if (index > 0 && runContextText(state.messages[index - 1]) !== undefined) return;
	if (index === -1) index = state.messages.length;
	const earlier = state.messages
		.slice(0, index)
		.flatMap((message) => runContextText(message) ?? []);
	const text = context
		.split(SECTION_BREAK)
		.map((section) => {
			const header = section.split('\n', 1)[0];
			if (!DEDUPED_SECTIONS.includes(header)) return section;
			for (const previousContext of earlier.toReversed()) {
				const previous = previousContext
					.split(SECTION_BREAK)
					.find((candidate) => candidate.split('\n', 1)[0] === header);
				if (previous === undefined || previous === unchanged(header)) continue;
				// ponytail: the referenced section can be trimmed away near the context limit; the agent can re-list files with tools
				return previous === section ? unchanged(header) : section;
			}
			return section;
		})
		.join('\n\n');
	const message: Message = {
		role: 'user',
		content: [{ type: 'text', internal: true, runContext: true, text }],
	};
	const target = state.messages[index];
	if (state.lease && state.pendingMessages) {
		const pendingIndex = target
			? state.pendingMessages.indexOf(target)
			: state.pendingMessages.length;
		// ponytail: a deferred run that reuses an older stored message keeps no run context; only legacy messages hit this
		if (pendingIndex === -1) return;
		state.pendingMessages.splice(pendingIndex, 0, message);
		state.messages.splice(index, 0, message);
		return;
	}
	state.messages.splice(index, 0, message);
	persist(state);
}
