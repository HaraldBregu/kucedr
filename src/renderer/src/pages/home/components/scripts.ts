import type { AgentMessage } from '../context/state';

export function chatScripts(messages: readonly AgentMessage[]): { id: string; label: string; messageId: string }[] {
	return messages.flatMap((message) => message.tools.flatMap((tool) => {
		if ((tool.type !== 'run_script' && tool.type !== 'run_plugin_script') || tool.state !== 'output-available') return [];
		const call = tool.input as { name?: unknown; input?: { title?: unknown } } | undefined;
		if (typeof call?.name !== 'string' || !call.name.trim()) return [];
		return [{ id: tool.toolCallId, label: typeof call.input?.title === 'string' && call.input.title.trim() ? call.input.title.trim() : call.name, messageId: message.id }];
	}));
}
