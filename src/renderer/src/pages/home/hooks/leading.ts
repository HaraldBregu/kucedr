import type { AgentModeInfo } from '@shared/agent_types';

/** Splits mode commands typed or pasted at the start of a prompt from the rest of it. */
export function leadingModes(
	prompt: string,
	modes: readonly AgentModeInfo[]
): { modeIds: string[]; prompt: string } {
	const modeIds: string[] = [];
	let rest = prompt.trimStart();
	for (;;) {
		const match = /^(\/[a-z0-9]+(?:-[a-z0-9]+)*)(?:\s+|$)/.exec(rest);
		const mode = match ? modes.find((candidate) => candidate.command === match[1]) : undefined;
		if (!match || !mode) return { modeIds, prompt: rest };
		if (!modeIds.includes(mode.id)) modeIds.push(mode.id);
		rest = rest.slice(match[0].length);
	}
}
