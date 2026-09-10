import type { RuntimeEvent, Tool, ToolCall } from '../types';
import {
	fileToolState,
	isFileCreation,
	rememberTool,
	type FileAccessContext,
} from '../context';
import { agentLocation } from '../../shared/agent_location';
import {
	addPermissionRule,
	recursivePermissionRule,
	resolveToolPermissionDetails,
	waitForToolPermission,
} from '../permissions';
import { approvedExecRoots } from '../permissions/approved_exec_roots';
import { inputFingerprint } from '../permissions/input_fingerprint';
import { redactApprovalInput } from '../permissions/redact_approval_input';
import { formatToolOutput } from './run_common';
import { limitToolOutput } from './run_limit_output';
import type { KeyedMutex } from '../mutex';
import { directoryPermissionTargets } from '../permissions/directory_permission_targets';
import type {
	AgentInteractionMode,
	AgentUserInputQuestion,
} from '../../../shared/agent_types';
import { waitForUserInput } from '../user_input/user_input_pending';
import { planCommandError } from '../plan/command';
import { toolPermissionTargets } from '../permissions/tool_permission_targets';
import { captureFiles } from '../history/capture';
import { recordFileOperation } from '../history/record';
import type { FileHistory } from '../history/types';
import { executionScope, type ExecutionScope } from '../execution/scope';
import { authorizedPaths } from '../permissions/access';
import type { ExecutionBudget } from '../execution/budget';
import { captureAccess } from '../permissions/capture_access';

export interface ToolCallSecurityContext {
	runId: string;
	scope?: ExecutionScope;
	budget?: ExecutionBudget;
	windowId?: number;
	interactionMode?: AgentInteractionMode;
}

export async function* runToolCall(
	tool: Tool | undefined,
	toolCall: ToolCall,
	signal?: AbortSignal,
	context?: FileAccessContext,
	security: ToolCallSecurityContext = { runId: 'internal' },
	resources?: KeyedMutex,
	history?: FileHistory
): AsyncGenerator<RuntimeEvent, void> {
	const startedAtMs = Date.now();
	let canonicalInput = toolCall.args;
	let parseError: unknown;
	let access: ReturnType<typeof captureAccess> = [];
	const scope: ExecutionScope = security.scope ?? { ownerId: `run:${security.runId}`, source: security.windowId === undefined ? 'child' : 'interactive', sessionId: security.runId, runId: security.runId };
	if (tool) {
		try {
			canonicalInput = tool.parseInput(toolCall.args);
			toolCall.args = canonicalInput;
			access = captureAccess(['read', 'write', 'edit', 'patch'].includes(toolCall.name)
				? toolPermissionTargets(toolCall.name, canonicalInput, agentLocation())
				: directoryPermissionTargets(toolCall.name, canonicalInput, agentLocation(), history));
		} catch (error) {
			parseError = error;
		}
	}
	const state = fileToolState(toolCall.name, canonicalInput, agentLocation());
	const createsFile = state ? isFileCreation(state) : false;

	yield {
		type: 'tool_call_start',
		toolCallId: toolCall.id,
		toolName: toolCall.name,
		input: canonicalInput,
	};

	let output: unknown;
	let isError: boolean | undefined;
	let permissionOutcome:
		| 'allow'
		| 'deny'
		| 'approve'
		| 'approve_always'
		| 'reject'
		| undefined;

	const budgetError = security.budget?.admit(tool, canonicalInput);
	if (budgetError) {
		output = budgetError;
		isError = true;
	} else if (!tool) {
		output = `Error: unknown tool '${toolCall.name}'`;
		isError = true;
	} else if ('__unparsed' in toolCall.args) {
		output = `Error: tool '${toolCall.name}' arguments were not valid JSON (likely truncated by the output token limit). Retry with smaller arguments, e.g. write large files in multiple steps.`;
		isError = true;
	} else if (parseError) {
		output = `Error: invalid input for '${toolCall.name}': ${parseError instanceof Error ? parseError.message : String(parseError)}`;
		isError = true;
	} else if (security.interactionMode === 'plan' && tool.planSafe !== true) {
		output = `Error: tool '${toolCall.name}' is unavailable in Plan mode`;
		isError = true;
	} else if (
		security.interactionMode === 'plan' &&
		toolCall.name === 'bash' &&
		planCommandError(canonicalInput, agentLocation())
	) {
		output = `Error: ${planCommandError(canonicalInput, agentLocation())}`;
		isError = true;
	} else if (toolCall.name === 'ask' || toolCall.name === 'select_screen_source') {
		const screenSelection = toolCall.name === 'select_screen_source';
		if (
			security.windowId === undefined ||
			(!screenSelection && security.interactionMode !== 'plan') ||
			(screenSelection && security.interactionMode !== 'default')
		) {
			output = screenSelection
				? 'Error: screen source selection is only available in an interactive chat run.'
				: 'Error: structured user input is only available in an interactive Plan run.';
			isError = true;
		} else {
			const questions = screenSelection
				? [{
					id: 'screen-source',
					header: 'Screen',
					question: 'Choose the display or window to record.',
					options: (canonicalInput.sources as Array<{ id: string; name: string; type: string }>).map(
						(source) => ({
							label: source.name,
							description: source.type === 'screen' ? 'Display' : 'Window',
						})
					),
				}] satisfies AgentUserInputQuestion[]
				: canonicalInput.questions as AgentUserInputQuestion[];
			const requestId = crypto.randomUUID();
			const fingerprint = inputFingerprint(canonicalInput);
			const expiresAtMs = Date.now() + 10 * 60_000;
			yield {
				type: 'user_input_request',
				requestId,
				toolCallId: toolCall.id,
				questions,
				expiresAt: new Date(expiresAtMs).toISOString(),
				inputFingerprint: fingerprint,
			};
			const answers = await waitForUserInput(
				{
					requestId,
					runId: security.runId,
					toolCallId: toolCall.id,
					inputFingerprint: fingerprint,
					questionIds: questions.map((question) => question.id),
					expiresAtMs,
					windowId: security.windowId,
				},
				signal
			);
			const status = answers ? 'resolved' : 'interrupted';
			yield {
				type: 'user_input_result',
				requestId,
				toolCallId: toolCall.id,
				status,
				answers: answers ?? [],
			};
			output = screenSelection
				? {
					status,
					sourceId: answers?.find((answer) => answer.questionId === 'screen-source')?.answer,
				}
				: { status, answers: answers ?? [] };
			isError = !answers;
		}
	} else {
		let resolution = executionScope.run(scope, () => resolveToolPermissionDetails(
			toolCall.name,
			canonicalInput,
			context,
			true,
			'ask',
			undefined,
			history
		));
		const capability = typeof tool.capability === 'function' ? tool.capability(canonicalInput) : tool.capability;
		const channelAllowed = scope.source !== 'channel' || ['search_web', 'fetch_web_page', 'subagent', 'subagents'].includes(tool.id);
		if (!capability || !channelAllowed) resolution = { ...resolution, mode: 'deny', persistable: false };
		const hardApproval = capability?.approval === true || (typeof tool.hardApproval === 'function'
			? tool.hardApproval(canonicalInput)
			: tool.hardApproval === true);
		if (hardApproval && resolution.mode !== 'deny') {
			resolution = {
				...resolution,
				mode: 'ask',
				approvalTargets: resolution.approvalTargets.length > 0
					? resolution.approvalTargets
					: resolution.targets,
				reason: capability?.approval ? 'sensitive_operation' : 'destructive_operation',
				persistable: false,
			};
		}
		let permission = resolution.mode;
		if (security.interactionMode === 'plan' && permission === 'ask') permission = 'deny';

		if (permission === 'ask' && security.windowId === undefined) permission = 'deny';

		if (permission === 'ask') {
			const approvalId = crypto.randomUUID();
			const fingerprint = inputFingerprint(canonicalInput);
			const expiresAtMs = Date.now() + 120_000;
			const allowOnce = !(
				process.platform === 'win32' &&
				toolCall.name === 'bash' &&
				resolution.reason === 'outside_trusted_location'
			);
			yield {
				type: 'tool_permission_request',
				approvalId,
				toolCallId: toolCall.id,
				toolName: toolCall.name,
				input: redactApprovalInput(canonicalInput),
				mode: 'ask',
				targets: resolution.approvalTargets,
				reason: resolution.reason ?? 'outside_trusted_location',
				persistable: resolution.persistable,
				allowOnce,
				expiresAt: new Date(expiresAtMs).toISOString(),
				inputFingerprint: fingerprint,
			};
			const decision = await waitForToolPermission(
				{
					approvalId,
					runId: security.runId,
					toolName: toolCall.name,
					inputFingerprint: fingerprint,
					expiresAtMs,
					...(security.windowId === undefined ? {} : { windowId: security.windowId }),
				},
				signal
			);
			const effectiveDecision =
				(decision === 'approve' && !allowOnce) || (decision === 'approve_always' && !resolution.persistable)
					? 'reject'
					: decision;
			permissionOutcome = effectiveDecision;
			if (effectiveDecision === 'approve_always' && resolution.persistable && resolution.kind) {
				for (const target of resolution.approvalTargets) {
					addPermissionRule(resolution.kind, 'allow', recursivePermissionRule(target));
				}
			}
			permission = effectiveDecision === 'reject' ? 'deny' : 'allow';
		}
		permissionOutcome ??= permission;

		if (permission === 'deny') {
			output = `Error: permission denied for '${toolCall.name}'`;
			isError = true;
		} else {
			try {
				if (signal?.aborted) throw signal.reason;
				const timeoutController = new AbortController();
				const timeoutTimer = setTimeout(
					() => timeoutController.abort(new DOMException('Tool call timed out.', 'TimeoutError')),
					tool.timeoutMs
				);
				timeoutTimer.unref?.();
				const toolSignal = signal
					? AbortSignal.any([signal, timeoutController.signal])
					: timeoutController.signal;
				const resourceTargets = directoryPermissionTargets(
					tool.id,
					canonicalInput,
					agentLocation(),
					history
				);
				const release = resources
					? await resources.acquire(resourceTargets, toolSignal)
					: () => undefined;
				let abort: (() => void) | undefined;
				let execution: Promise<unknown> | undefined;
				try {
					toolSignal.throwIfAborted();
					const current = executionScope.run(scope, () => resolveToolPermissionDetails(toolCall.name, canonicalInput, context, true, 'ask', undefined, history));
					if (current.mode === 'deny' || (permissionOutcome === 'allow' && current.mode !== 'allow' && resolution.mode === 'allow')) throw new Error('Permission changed before execution.');
					const aborted = new Promise<never>((_, reject) => {
						abort = () => reject(toolSignal.reason ?? new Error('Tool call aborted.'));
						toolSignal.addEventListener('abort', abort, { once: true });
					});
					const historyTargets = ['write', 'edit', 'patch'].includes(toolCall.name)
						? toolPermissionTargets(toolCall.name, canonicalInput, agentLocation())
						: [];
					const before = historyTargets.length > 0 ? captureFiles(historyTargets) : [];
					const run = (): Promise<unknown> => executionScope.run(scope, () => authorizedPaths.run(access, () => Promise.resolve(tool.run(canonicalInput, toolSignal))));
					const approvedRoots = permissionOutcome === 'approve' && toolCall.name === 'bash'
						? resolution.approvalTargets
						: [];
					execution = Promise.resolve().then(() => { toolSignal.throwIfAborted(); return approvedExecRoots.run(approvedRoots, run); }).finally(release);
					output = await Promise.race([
						execution,
						aborted,
					]);
					if (history && historyTargets.length > 0) {
						recordFileOperation(
							history,
							security.runId,
							toolCall.id,
							toolCall.name,
							before,
							captureFiles(historyTargets)
						);
					}
					output = limitToolOutput(output, tool.maxOutputBytes);
					if (toolCall.name === 'read' && state) rememberTool(context, state);
					if (createsFile && state) rememberTool(context, state);
				} finally {
					if (!execution) release();
					clearTimeout(timeoutTimer);
					if (abort) toolSignal.removeEventListener('abort', abort);
				}
			} catch (error) {
				if (signal?.aborted) {
					toolCall.result = { content: 'Cancelled; an in-flight effect may still be settling.', isError: true };
					throw error;
				}
				const message = error instanceof Error ? error.message : String(error);
				output = `Error: tool '${toolCall.name}' failed: ${message}`;
				isError = true;
			}
		}
	}

	toolCall.result = {
		content: formatToolOutput(output),
		isError,
	};

	security.budget?.observeOutput(Buffer.byteLength(formatToolOutput(output), 'utf8'));
	security.budget?.outcomes.set(toolCall.id, structuredClone(toolCall));
	yield {
		type: 'tool_call_end',
		toolCallId: toolCall.id,
		toolName: toolCall.name,
		input: canonicalInput,
		output,
		isError,
		durationMs: Date.now() - startedAtMs,
		...(permissionOutcome ? { permissionOutcome } : {}),
	};
}
