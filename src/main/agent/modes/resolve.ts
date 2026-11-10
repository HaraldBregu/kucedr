import { listModes } from './list';
import { NO_MODE, type ModeDefinition, type ModePolicy, type ModeShell } from './types';

const SHELL_RANK: Record<ModeShell, number> = { default: 0, 'read-only': 1, none: 2 };

/** Combines modes so each one can only narrow the run. An unavailable mode is an error, never no mode. */
export function resolveModes(
	ids: readonly string[],
	available: readonly ModeDefinition[]
): ModePolicy {
	if (ids.length === 0) return { ...NO_MODE, available };
	const active = [...new Set(ids)].sort().map((id) => {
		const mode = available.find((candidate) => candidate.id === id);
		if (!mode) throw new Error(`Mode "${id}" is unavailable. Enable its plugin or remove the mode.`);
		return mode;
	});
	if (active.filter((mode) => mode.output).length > 1) {
		throw new Error('Only one active mode can define an output format.');
	}
	if (new Set(active.flatMap((mode) => (mode.model ? [mode.model] : []))).size > 1) {
		throw new Error('Only one active mode can define a model.');
	}

	const lists = active.flatMap((mode) => (Array.isArray(mode.tools) ? [mode.tools as string[]] : []));
	const toolIds = lists.length
		? lists.reduce((kept, list) => kept.filter((id) => list.includes(id)))
		: undefined;
	const readOnly = active.some((mode) => mode.tools === 'read-only');
	const permissions = active.some((mode) => mode.permissions === 'deny-asks')
		? 'deny-asks'
		: 'default';
	const shell = active
		.map((mode) => mode.shell ?? 'default')
		.reduce((strictest, next) => (SHELL_RANK[next] > SHELL_RANK[strictest] ? next : strictest));
	const prompts = (isProtected: boolean): string =>
		active
			.filter((mode) => mode.prompt && Boolean(mode.protectedPrompt) === isProtected)
			.map((mode) => mode.prompt)
			.join('\n\n');
	const effort = active.find((mode) => mode.effort)?.effort;
	const model = active.find((mode) => mode.model)?.model;
	const output = active.find((mode) => mode.output)?.output;

	return {
		ids: active.map((mode) => mode.id),
		available,
		restricted: readOnly || toolIds !== undefined || permissions !== 'default' || shell !== 'default',
		readOnly,
		ask: active.every((mode) => mode.ask !== false),
		...(toolIds ? { toolIds } : {}),
		permissions,
		shell,
		prompt: prompts(false),
		protectedPrompt: prompts(true),
		...(effort ? { effort } : {}),
		...(model ? { model } : {}),
		...(output ? { output } : {}),
	};
}
