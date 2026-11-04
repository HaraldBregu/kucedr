import type { AgentMessage, AgentRunState } from '../context';

const runStateLabels: Record<AgentRunState, string> = {
	idle: 'Ready',
	thinking: 'Churning',
	reasoning: 'Churning',
	using_tools: 'Using tools',
	awaiting_input: 'Awaiting input',
	answering: 'Answering',
	completed: 'Completed',
	cancelled: 'Cancelled',
	error: 'Error',
};

export function isRunningState(state: AgentRunState): boolean {
	return (
		state === 'thinking' ||
		state === 'reasoning' ||
		state === 'using_tools' ||
		state === 'awaiting_input' ||
		state === 'answering'
	);
}

function formatElapsedSeconds(message: AgentMessage): string | undefined {
	if (message.startedAtMs === undefined || message.completedAtMs === undefined) {
		return undefined;
	}

	const seconds = Math.max(1, Math.ceil((message.completedAtMs - message.startedAtMs) / 1000));
	return `${seconds} second${seconds === 1 ? '' : 's'}`;
}

export function statusLabel(
	message: AgentMessage,
	toolSelection?: { selecting: string; selected: (names: string) => string }
): string {
	if (message.toolSelection && toolSelection) {
		if (message.toolSelection.state === 'selecting') return toolSelection.selecting;
		const visible = message.toolSelection.names.slice(0, 3);
		const overflow = message.toolSelection.names.length - visible.length;
		const names = `${visible.join(', ')}${overflow > 0 ? ` +${overflow}` : ''}`;
		return toolSelection.selected(names);
	}
	if (message.state === 'answering' && message.tools.length > 0) {
		return 'Answering with tool results';
	}

	if (message.state === 'completed') {
		const elapsed = formatElapsedSeconds(message);
		if (message.tools.length > 0) {
			return elapsed ? `Finished in ${elapsed}` : 'Finished';
		}
		return elapsed ? `Thought for ${elapsed}` : 'Thought for a moment';
	}

	return runStateLabels[message.state];
}
