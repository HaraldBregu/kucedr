import type { RunStop } from '../extension';
import { isEnvelopeValid } from './output';
import { unfinishedModes } from './state/unfinished';
import type { ModeDefinition, ModePolicy } from './types';

/** What the active modes make of a final reply. The caller owns the caps and says which outcomes are still allowed. */
export function modeStop(
	content: string,
	mode: ModePolicy,
	tracked: readonly ModeDefinition[],
	sessionDirectory: string,
	since: number,
	may: { readonly retry: boolean; readonly continue: boolean }
): RunStop {
	if (may.retry && mode.output && !isEnvelopeValid(content, mode.output.envelope)) {
		return {
			kind: 'retry',
			instruction: `Your previous final response was rejected. The response must contain exactly one non-empty <${mode.output.envelope}> envelope and no other text. Write the complete final response again in that form.`,
		};
	}
	const unfinished = may.continue
		? unfinishedModes(sessionDirectory, mode.ids, tracked, since)
		: [];
	if (unfinished.length === 0) return { kind: 'accept' };
	return {
		kind: 'continue',
		message: `<mode_continue>\nNot finished: the ${unfinished.map((entry) => entry.id).join(', ')} state is still open. Keep working on the user's request without asking the user anything. If the state has no items for this request yet, first record the objective and success criteria with update_mode_state. Set its status to "completed" once every item is done, or "blocked" with a note if something concretely prevents progress.\n</mode_continue>`,
	};
}
