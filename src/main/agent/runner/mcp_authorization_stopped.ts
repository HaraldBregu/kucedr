import type { ToolCall } from '../types';

export function mcpAuthorizationStopped(call: ToolCall): boolean {
	if (call.name !== 'request_mcp_authorization' || !call.result) return false;
	try {
		const result = JSON.parse(call.result.content) as { status?: unknown };
		return result.status !== 'authorized' && result.status !== 'already_authorized';
	} catch {
		return true;
	}
}
