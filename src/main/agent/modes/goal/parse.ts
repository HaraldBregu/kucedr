export type GoalCommand =
	| { action: 'status' | 'pause' | 'resume' | 'clear'; note?: string }
	| { action: 'create'; objective: string };

export function parseGoalCommand(message: string): GoalCommand | undefined {
	const match = message.trim().match(/^\/goal(?:\s+([\s\S]+))?$/i);
	if (!match) return undefined;
	const value = match[1]?.trim() ?? '';
	if (!value) return { action: 'status' };
	const [command, ...rest] = value.split(/\s+/);
	const note = rest.join(' ').trim();
	if (command.toLowerCase() === 'pause') return { action: 'pause', ...(note ? { note } : {}) };
	if (command.toLowerCase() === 'resume') return { action: 'resume', ...(note ? { note } : {}) };
	if (command.toLowerCase() === 'clear') return { action: 'clear' };
	return { action: 'create', objective: value };
}
