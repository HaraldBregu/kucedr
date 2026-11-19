import type { AgentRunRecord, AgentRunRegistry, AgentRunRequest } from './state_types';

export function admitRun<TOptions>(
	registry: AgentRunRegistry<TOptions>,
	request: AgentRunRequest<TOptions>
): AgentRunRecord<TOptions> {
	if (registry.has(request.id)) throw new Error(`Agent run '${request.id}' is already active.`);
	const record: AgentRunRecord<TOptions> = {
		request: Object.freeze({ ...request }),
		controller: new AbortController(),
		responseEvents: [],
		followUps: [],
		lifecycle: { status: 'queued' },
	};
	registry.set(request.id, record);
	return record;
}
