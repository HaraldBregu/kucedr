import type { ToolCall } from '../types';

export function mcpAuthorizationStopped(call: ToolCall): boolean {
	if (call.name !== 'request_mcp_authorization' || !call.result) return false;
	try {
		const result = typeof call.result.content === 'string'
			? JSON.parse(call.result.content) as { status?: unknown }
			: undefined;
		return result?.status === 'cancelled' || result?.status === 'authorization_failed';
	} catch {
		return false;
	}
}
