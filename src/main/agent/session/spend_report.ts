import { open } from 'node:fs/promises';
import type { AgentSessionSummary, AgentSpendReport } from '../../../shared/agent_types';
import { unsealLine } from '../../vault/unseal_line';
import { sessionPath } from './session_session_path';

export async function readSpendReport(
	root: string,
	sessions: readonly AgentSessionSummary[]
): Promise<AgentSpendReport> {
	type Totals = { costUsd: number; inputTokens: number; outputTokens: number; runCount: number };
	type Run = Totals & { providerId: string; month: string; hasReportedCost: boolean };
	const byMonth = new Map<string, { costUsd: number; runCount: number }>();
	const byProvider = new Map<string, Totals>();
	const bySession = new Map<string, Totals>();
	let totalCostUsd = 0;
	let reportedRunCount = 0;

	for (const session of sessions) {
		const file = sessionPath(root, session.id, 'run.jsonl');
		const handle = await open(file, 'r').catch((error: NodeJS.ErrnoException) => {
			if (error.code === 'ENOENT') return null;
			throw error;
		});
		if (!handle) continue;
		const lines = handle.readLines({ autoClose: false });
		let run: Run | undefined;
		try {
			for await (const line of lines) {
				let row: { timestamp?: unknown; event?: Record<string, unknown> };
				try {
					row = JSON.parse(unsealLine(line)) as typeof row;
				} catch {
					continue;
				}
				const event = row.event;
				if (!event || typeof event.type !== 'string') continue;
				if (event.type === 'run_started') {
					const date = typeof row.timestamp === 'string' ? new Date(row.timestamp) : undefined;
					run = {
						providerId: typeof event.providerId === 'string' ? event.providerId : 'unknown',
						month: date && Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 7) : 'unknown',
						costUsd: 0,
						inputTokens: 0,
						outputTokens: 0,
						runCount: 0,
						hasReportedCost: false,
					};
					continue;
				}
				if (!run) continue;
				if (event.type === 'model_call_end' && event.usage && typeof event.usage === 'object') {
					const usage = event.usage as Record<string, unknown>;
					if (typeof usage.costUsd === 'number' && Number.isFinite(usage.costUsd) && usage.costUsd >= 0) {
						run.costUsd += usage.costUsd;
						run.hasReportedCost = true;
					}
					if (typeof usage.inputTokens === 'number' && Number.isFinite(usage.inputTokens)) run.inputTokens += usage.inputTokens;
					if (typeof usage.outputTokens === 'number' && Number.isFinite(usage.outputTokens)) run.outputTokens += usage.outputTokens;
					continue;
				}
				if (event.type !== 'run_finished' && event.type !== 'run_error') continue;
				if (run.hasReportedCost) {
					run.runCount = 1;
					totalCostUsd += run.costUsd;
					reportedRunCount += 1;
					const month = byMonth.get(run.month) ?? { costUsd: 0, runCount: 0 };
					month.costUsd += run.costUsd;
					month.runCount += 1;
					byMonth.set(run.month, month);
				}
				const provider = byProvider.get(run.providerId) ?? { costUsd: 0, inputTokens: 0, outputTokens: 0, runCount: 0 };
				provider.costUsd += run.costUsd;
				provider.inputTokens += run.inputTokens;
				provider.outputTokens += run.outputTokens;
				provider.runCount += run.runCount;
				byProvider.set(run.providerId, provider);
				const chat = bySession.get(session.id) ?? { costUsd: 0, inputTokens: 0, outputTokens: 0, runCount: 0 };
				chat.costUsd += run.costUsd;
				chat.inputTokens += run.inputTokens;
				chat.outputTokens += run.outputTokens;
				chat.runCount += run.runCount;
				bySession.set(session.id, chat);
				run = undefined;
			}
		} finally {
			lines.close();
			await handle.close();
		}
	}

	return {
		totalCostUsd,
		reportedRunCount,
		byMonth: [...byMonth.entries()]
			.map(([month, totals]) => ({ month, ...totals }))
			.sort((left, right) => right.month.localeCompare(left.month)),
		byProvider: [...byProvider.entries()]
			.map(([providerId, totals]) => ({ providerId, ...totals }))
			.sort((left, right) => right.costUsd - left.costUsd),
		bySession: [...bySession.entries()]
			.map(([sessionId, totals]) => ({
				sessionId,
				title: sessions.find((session) => session.id === sessionId)?.title ?? sessionId,
				...totals,
			}))
			.sort((left, right) => right.costUsd - left.costUsd),
	};
}
