import { addUserMessage, type SessionState } from '../session';
import type { RuntimeEvent, RuntimeInput } from '../types';

export function* deliverFollowUps(
	session: SessionState,
	input: RuntimeInput
): Generator<RuntimeEvent, boolean> {
	const followUps = input.followUps?.() ?? [];
	for (const followUp of followUps) {
		addUserMessage(session, followUp.text, { createdAtMs: Date.now(), followUp: true });
		yield { type: 'follow_up', id: followUp.id, text: followUp.text };
	}
	return followUps.length > 0;
}
