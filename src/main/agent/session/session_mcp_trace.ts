import type { SessionState } from './session_types';

const diagnosticsBySession = new WeakMap<SessionState, unknown>();

export function mcpTraceEntry(state: SessionState, entry: unknown): unknown | undefined {
	if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return undefined;
	const event = entry as Record<string, unknown>;
	if (event.type === 'run_started' && event.mcpDiscovery) {
		diagnosticsBySession.set(state, event.mcpDiscovery);
		return undefined;
	}
	if (!['run_finished', 'run_error'].includes(String(event.type))) return undefined;
	const diagnostics = diagnosticsBySession.get(state);
	diagnosticsBySession.delete(state);
	return diagnostics ? { type: 'mcp_discovery_result', mcpDiscovery: diagnostics } : undefined;
}
