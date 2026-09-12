import type { SessionUsage, Tool } from '../types';

export class ExecutionBudget {
	readonly usage = { inputTokens: 0, outputTokens: 0 };
	readonly outcomes = new Map<string, import('../types').ToolCall>();
	calls = 0;
	paidCalls = 0;
	webCalls = 0;
	outputBytes = 0;
	unreportedModelCalls = 0;
	estimatedTokens = 0;
	private reservedTokens = 0;
	exhausted = false;

	constructor(readonly limits: { tokens?: number; calls?: number; paid?: number; web?: number; output?: number } = {}) {}

	wouldExceed(calls: Array<{ tool: Tool | undefined; input: Record<string, unknown> }>): boolean {
		let total = this.calls;
		let paid = this.paidCalls;
		let web = this.webCalls;
		for (const { tool, input } of calls) {
			const capability = typeof tool?.capability === 'function' ? tool.capability(input) : tool?.capability;
			total += 1;
			if (capability?.effects.includes('paid')) paid += 1;
			if (['search_web', 'fetch_web_page', 'use_web_browser'].includes(tool?.id ?? '')) web += 1;
		}
		return this.exhausted || total > (this.limits.calls ?? 100) ||
			paid > (this.limits.paid ?? 3) || web > (this.limits.web ?? Number.POSITIVE_INFINITY);
	}

	admit(tool: Tool | undefined, input: Record<string, unknown>): string | undefined {
		const capability = typeof tool?.capability === 'function' ? tool.capability(input) : tool?.capability;
		const paid = capability?.effects.includes('paid') === true;
		const web = ['search_web', 'fetch_web_page', 'use_web_browser'].includes(tool?.id ?? '');
		if (this.exhausted || this.calls >= (this.limits.calls ?? 100) ||
			(paid && this.paidCalls >= (this.limits.paid ?? 3)) ||
			(web && this.webCalls >= (this.limits.web ?? Number.POSITIVE_INFINITY))) {
			this.exhausted = true;
			return 'Execution budget exhausted; this action was not executed.';
		}
		this.calls += 1;
		if (paid) this.paidCalls += 1;
		if (web) this.webCalls += 1;
		return undefined;
	}

	observeOutput(bytes: number): void {
		this.outputBytes += bytes;
		if (this.outputBytes >= (this.limits.output ?? 2_000_000)) this.exhausted = true;
	}

	reserveModel(inputTokens: number, outputTokens: number): (usage?: SessionUsage) => void {
		const reservation = Math.ceil(inputTokens + outputTokens);
		const consumed = this.usage.inputTokens + this.usage.outputTokens + this.estimatedTokens;
		if (this.exhausted || consumed + this.reservedTokens + reservation > (this.limits.tokens ?? Number.POSITIVE_INFINITY)) {
			this.exhausted = true;
			throw new Error('Execution token budget exhausted before model invocation.');
		}
		this.reservedTokens += reservation;
		let settled = false;
		return (usage) => {
			if (settled) return;
			settled = true;
			this.reservedTokens -= reservation;
			if (usage) {
				this.usage.inputTokens += usage.inputTokens;
				this.usage.outputTokens += usage.outputTokens;
			} else {
				this.unreportedModelCalls += 1;
				this.estimatedTokens += reservation;
			}
			if (this.usage.inputTokens + this.usage.outputTokens + this.estimatedTokens >= (this.limits.tokens ?? Number.POSITIVE_INFINITY)) this.exhausted = true;
		};
	}
}
