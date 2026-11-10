import type { RunExtension, RunExtensionRequest } from '../extension';
import { allowsTool } from './allows';
import { modeEffort } from './effort';
import { modeGate } from './gate';
import { listModes } from './list';
import { resolveModes } from './resolve';
import { stateContext } from './state/context';
import { modeStateTool } from './state/tool';
import { trackedModes } from './state/tracked';
import { modeStop } from './stop';

/** Modes as a run extension: chat runs only, sub-agents inherit just the tool, shell and permission limits. */
export function modeExtension(request: RunExtensionRequest): RunExtension | undefined {
	if (request.category !== 'main') return undefined;
	const mode = resolveModes(request.modeIds, listModes());
	const since = Date.now();
	const tracked = trackedModes(request.sessionDirectory, mode.ids, mode.available);
	const model = mode.model ?? request.modelId;
	const effort = modeEffort(mode.effort, request.providerId, model);
	const child: RunExtension = {
		ids: [],
		restricted: mode.restricted,
		ask: false,
		readOnlyShell: mode.shell === 'read-only',
		denyAsks: mode.permissions === 'deny-asks',
		prompt: '',
		protectedPrompt: '',
		tools: [],
		allows: (tool) => allowsTool(mode, tool),
		gate: (tool, input, workspace) => modeGate(mode, tool, input, workspace),
		context: () => '',
		stop: () => ({ kind: 'accept' }),
		child: () => child,
	};
	return {
		...child,
		ids: mode.ids,
		ask: mode.ask,
		prompt: mode.prompt,
		protectedPrompt: mode.protectedPrompt,
		...(mode.model ? { model: mode.model } : {}),
		...(effort ? { effort } : {}),
		tools: tracked.length > 0 ? [modeStateTool(request.sessionDirectory, tracked)] : [],
		context: () =>
			tracked.length > 0 ? stateContext(request.sessionDirectory, tracked, mode.ids, since) : '',
		stop: (content, may) => modeStop(content, mode, tracked, request.sessionDirectory, since, may),
	};
}
