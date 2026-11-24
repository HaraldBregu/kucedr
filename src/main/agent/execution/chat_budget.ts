import type { AgentRunBudget, AgentRunBudgetWarning } from '../../../shared/agent_types';
import type { RuntimeEvent } from '../types';
import { inputFingerprint } from '../permissions/input_fingerprint';
import { waitForUserInput } from '../user_input/user_input_pending';

export class RunBudgetStopped extends Error {}

export class ChatRunBudget {
	private turns = 0;
	private tokens = 0;
	private readonly warned = new Set<keyof AgentRunBudget>();

	constructor(
		private readonly limits: AgentRunBudget,
		private readonly runId: string,
		private readonly windowId: number
	) {}

	*warnings(): Generator<AgentRunBudgetWarning> {
		for (const unit of ['turns', 'tokens'] as const) {
			const limit = this.limits[unit];
			const used = this[unit];
			if (limit === undefined || used < limit * 0.8 || this.warned.has(unit)) continue;
			this.warned.add(unit);
			yield { type: 'run_budget_warning', unit, used, limit };
		}
	}

	async *beforeCall(
		input: number,
		maxOutput: number,
		signal: AbortSignal
	): AsyncGenerator<RuntimeEvent, number> {
		const remaining = (this.limits.tokens ?? Infinity) - this.tokens - input;
		const reasons: string[] = [];
		if (this.limits.turns !== undefined && this.turns >= this.limits.turns)
			reasons.push(`This run has used ${this.turns} of ${this.limits.turns} model turns.`);
		if (remaining < 1)
			reasons.push(
				`This run has used ${this.tokens} of ${this.limits.tokens} tokens. The next input needs about ${input} tokens.`
			);
		if (reasons.length) {
			const requestId = crypto.randomUUID();
			const toolCallId = `run-budget:${requestId}`;
			const expiresAtMs = Date.now() + 10 * 60_000;
			const fingerprint = inputFingerprint({ requestId, limits: this.limits });
			const response = waitForUserInput(
				{
					requestId,
					toolCallId,
					inputFingerprint: fingerprint,
					runId: this.runId,
					questionIds: ['run-budget'],
					expiresAtMs,
					windowId: this.windowId,
				},
				signal
			);
			yield {
				type: 'user_input_request',
				requestId,
				toolCallId,
				inputFingerprint: fingerprint,
				expiresAt: new Date(expiresAtMs).toISOString(),
				questions: [
					{
						id: 'run-budget',
						header: 'Run budget',
						question: `${reasons.join(' ')} Allow one more model call?`,
						options: [
							{ label: 'Stop', description: 'Finish this run here.' },
							{ label: 'Continue', description: 'Allow one more model call.' },
						],
					},
				],
			};
			const answers = await response;
			yield {
				type: 'user_input_result',
				requestId,
				toolCallId,
				status: answers ? 'resolved' : 'interrupted',
				answers: answers ?? [],
			};
			signal.throwIfAborted();
			if (answers?.[0]?.answer !== 'Continue') throw new RunBudgetStopped();
		}
		return remaining < 1 ? maxOutput : Math.min(maxOutput, remaining);
	}

	record(tokens: number): void {
		this.turns += 1;
		this.tokens += tokens;
	}
}
