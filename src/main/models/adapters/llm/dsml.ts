import { randomUUID } from 'node:crypto';
import { invokes } from './invokes';
import type { LlmProviderEvent } from './llm_types';

const MARKER = /<[｜|]+\s*DSML\s*[｜|]+/;
const PARTIAL = /<(?:[｜|]+\s*(?:D(?:S(?:M(?:L\s*)?)?)?)?)?$/;

export async function* dsml(
	events: AsyncIterable<LlmProviderEvent>
): AsyncIterable<LlmProviderEvent> {
	let held = '';
	let capturing = false;
	for await (const event of events) {
		if (event.type === 'text_delta') {
			held += event.text;
			if (capturing) continue;
			const marker = held.search(MARKER);
			capturing = marker >= 0;
			const partial = capturing ? marker : held.search(PARTIAL);
			const cut = partial >= 0 ? partial : held.length;
			if (cut > 0) yield { type: 'text_delta', text: held.slice(0, cut) };
			held = held.slice(cut);
			continue;
		}
		if (event.type !== 'message_end') {
			yield event;
			continue;
		}
		const calls = capturing ? invokes(held) : undefined;
		if (!calls) {
			if (held) yield { type: 'text_delta', text: held };
			yield event;
			continue;
		}
		for (const call of calls) {
			const id = `dsml-${randomUUID()}`;
			yield { type: 'tool_call_start', id, name: call.name };
			yield { type: 'tool_call_args_delta', id, jsonDelta: JSON.stringify(call.args) };
			yield { type: 'tool_call_end', id };
		}
		yield { ...event, stopReason: 'tool_calls' };
	}
}
