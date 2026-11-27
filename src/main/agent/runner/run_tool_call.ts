import type { RuntimeEvent, Tool, ToolCall } from '../types';
import { fileToolState, isFileCreation, rememberTool, type FileAccessContext } from '../context';
import { currentWorkspace } from '../../workspaces/current';
import {
	addPermissionRule,
	getPermissions,
	resolvePermission,
	waitForToolPermission,
	type ToolAccess,
} from '../permissions';
import { approvedExecRoots } from '../permissions/approved_exec_roots';
import { inputFingerprint } from '../permissions/input_fingerprint';
import { redactApprovalInput } from '../permissions/redact_approval_input';
import { formatToolOutput } from './run_common';
import { limitToolOutput } from './run_limit_output';
import { untrusted } from './untrusted';
import type { KeyedMutex } from '../mutex';
import type { AgentUserInputQuestion } from '../../../shared/agent_types';
import { waitForUserInput } from '../user_input/user_input_pending';
import type { RunExtension } from '../extension';
import { realPath } from '../../shared/real_path';
import { captureFiles } from '../history/capture';
import { recordFileOperation } from '../history/record';
import type { FileHistory } from '../history/types';
import { executionScope, type ExecutionScope } from '../execution/scope';
import { authorizedPaths } from '../permissions/access';
import type { ExecutionBudget } from '../execution/budget';
import { captureAccess } from '../permissions/capture_access';
import { getToolConfiguration, setToolProfileTool } from '../agent_store';
import { isAgentToolAllowedForProfile, type AgentToolProfileId } from '../../../shared/agent_tools';
import { getMcpOauth } from '../../mcp';
import { mcpAuthorizationRequired } from './mcp_authorization_required';
import { runPluginHooks } from '../../plugins';

export interface ToolCallSecurityContext {
	runId: string;
	scope?: ExecutionScope;
	budget?: ExecutionBudget;
	windowId?: number;
	extension?: RunExtension;
	toolProfile?: AgentToolProfileId;
}

export async function* runToolCall(
	resolved: Tool | 'unloaded' | undefined,
	toolCall: ToolCall,
	signal?: AbortSignal,
	context?: FileAccessContext,
	security: ToolCallSecurityContext = { runId: 'internal' },
	resources?: KeyedMutex,
	history?: FileHistory
): AsyncGenerator<RuntimeEvent, void> {
	const startedAtMs = Date.now();
	const tool = resolved === 'unloaded' ? undefined : resolved;
	let canonicalInput = toolCall.args;
	let parseError: unknown;
	let access: ReturnType<typeof captureAccess> = [];
	let toolAccess: ToolAccess = {};
	const scope: ExecutionScope = {
		...(security.scope ?? {
			ownerId: `run:${security.runId}`,
			source: security.windowId === undefined ? 'child' : 'interactive',
			sessionId: security.runId,
			runId: security.runId,
		}),
		...(security.toolProfile ? { profile: security.toolProfile } : {}),
		interactive: security.windowId !== undefined,
	};
	const declaredAccess = (): ToolAccess =>
		executionScope.run(scope, () => tool?.access?.(canonicalInput) ?? {});
	let accessTargets: string[] = [];
	if (tool && !('__unparsed' in toolCall.args)) {
		try {
			canonicalInput = tool.parseInput(toolCall.args);
			toolCall.args = canonicalInput;
			toolAccess = declaredAccess();
			accessTargets = [
				...(toolAccess.read ?? []),
				...(toolAccess.write ?? []),
				...(toolAccess.exec ?? []),
			].map(realPath);
			access = captureAccess(accessTargets);
		} catch (error) {
			parseError = error;
		}
	}
	const state = fileToolState(toolCall.name, canonicalInput, currentWorkspace().files);
	const createsFile = state ? isFileCreation(state) : false;

	yield {
		type: 'tool_call_start',
		toolCallId: toolCall.id,
		toolName: toolCall.name,
		input: canonicalInput,
	};

	let output: unknown;
	let isError: boolean | undefined;
	let authorizationRequired: ReturnType<typeof mcpAuthorizationRequired>;
	let permissionOutcome: 'allow' | 'deny' | 'approve' | 'approve_always' | 'reject' | undefined;

	const extension = security.extension;
	let gateError: string | undefined;
	let hookedTool: Record<string, unknown> | undefined;
	let abortError: { reason: unknown } | undefined;
	let budgetError: string | undefined;
	const exhausted = (): boolean =>
		Boolean((budgetError = security.budget?.admit(tool, canonicalInput)));
	if (!tool && exhausted()) {
		output = budgetError;
		isError = true;
	} else if (!tool) {
		output =
			resolved === 'unloaded'
				? `Error: tool '${toolCall.name}' is not loaded. Call tool_search with query "${toolCall.name}", then call it on the next turn.`
				: `Error: tool '${toolCall.name}' does not exist or is not available for this agent.`;
		isError = true;
	} else if ('__unparsed' in toolCall.args) {
		output = `Error: tool '${toolCall.name}' arguments were not valid JSON (likely truncated by the output token limit). Retry with smaller arguments, e.g. write large files in multiple steps.`;
		isError = true;
	} else if (parseError) {
		output = `Error: invalid input for '${toolCall.name}': ${parseError instanceof Error ? parseError.message : String(parseError)}`;
		isError = true;
	} else if ((gateError = extension?.gate(tool, canonicalInput, currentWorkspace().files))) {
		output = `Error: ${gateError}`;
		isError = true;
	} else if (
		security.toolProfile &&
		!isAgentToolAllowedForProfile(
			security.toolProfile,
			tool.policy ?? { kind: 'builtin', id: tool.id }
		)
	) {
		output = `Error: tool '${toolCall.name}' is unavailable for this agent`;
		isError = true;
	} else if (
		['ask', 'select_screen_source', 'request_mcp_authorization'].includes(toolCall.name) &&
		exhausted()
	) {
		output = budgetError;
		isError = true;
	} else if (toolCall.name === 'ask' || toolCall.name === 'select_screen_source') {
		const screenSelection = toolCall.name === 'select_screen_source';
		if (
			security.windowId === undefined ||
			(!screenSelection && extension?.ask === false) ||
			(screenSelection && extension?.restricted)
		) {
			output = screenSelection
				? 'Error: screen source selection is only available in an interactive chat run.'
				: 'Error: structured user input is only available in an interactive run of a mode that asks.';
			isError = true;
		} else {
			const questions = screenSelection
				? ([
						{
							id: 'screen-source',
							header: 'Screen',
							question: 'Choose the display or window to record.',
							options: (
								canonicalInput.sources as Array<{ id: string; name: string; type: string }>
							).map((source) => ({
								label: source.name,
								description: source.type === 'screen' ? 'Display' : 'Window',
							})),
						},
					] satisfies AgentUserInputQuestion[])
				: (canonicalInput.questions as AgentUserInputQuestion[]);
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
	} else if (toolCall.name === 'request_mcp_authorization') {
		if (security.windowId === undefined || extension?.restricted) {
			output = 'Error: MCP authorization is only available in an interactive chat run.';
			isError = true;
		} else {
			try {
				const checked = (await tool.run(canonicalInput, signal)) as {
					status: 'already_authorized' | 'authorization_required';
					serverId: string;
					serverName?: string;
				};
				if (checked.status !== 'authorization_required') {
					output = checked;
				} else {
					const requestId = crypto.randomUUID();
					const fingerprint = inputFingerprint(canonicalInput);
					const expiresAtMs = Date.now() + 7 * 24 * 60 * 60_000;
					const questions: AgentUserInputQuestion[] = [
						{
							id: 'mcp-authorization',
							header: 'MCP',
							question: `Authorize ${checked.serverName ?? checked.serverId}?`,
							options: [
								{ label: 'Authorize', description: 'Continue the run after OAuth succeeds.' },
								{ label: 'Cancel', description: 'End the run without authorization.' },
							],
						},
					];
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
							questionIds: ['mcp-authorization'],
							expiresAtMs,
							windowId: security.windowId,
						},
						signal
					);
					yield {
						type: 'user_input_result',
						requestId,
						toolCallId: toolCall.id,
						status: answers ? 'resolved' : 'interrupted',
						answers: answers ?? [],
					};
					const accepted = answers?.[0]?.answer === 'authorized';
					const authorized =
						accepted && Boolean(getMcpOauth(checked.serverId).tokens?.access_token);
					output = {
						status: authorized ? 'authorized' : accepted ? 'authorization_failed' : 'cancelled',
						serverId: checked.serverId,
						serverName: checked.serverName,
					};
					isError = !authorized;
				}
			} catch (error) {
				output = `Error: ${error instanceof Error ? error.message : String(error)}`;
				isError = true;
			}
		}
	} else {
		const capability =
			typeof tool.capability === 'function' ? tool.capability(canonicalInput) : tool.capability;
		const hardApproval = capability?.approval === true;
		const checkPermission = (): ReturnType<typeof resolvePermission> =>
			resolvePermission({
				access: declaredAccess(),
				permissions: getPermissions(),
				setting: getToolConfiguration(
					security.toolProfile ?? 'chat',
					tool.policy ?? { kind: 'builtin', id: tool.id }
				).permission,
				approval: hardApproval,
				interactive: security.windowId !== undefined,
				context,
			});
		let resolution = checkPermission();
		if (!capability) resolution = { ...resolution, mode: 'deny', persistable: false };
		const mcpPolicy = tool.policy?.kind === 'mcp' && !hardApproval ? tool.policy : undefined;
		const persistable = resolution.persistable || Boolean(mcpPolicy);
		let permission = resolution.mode;
		if (extension?.denyAsks && permission === 'ask') permission = 'deny';

		if (permission === 'ask') {
			const approvalId = crypto.randomUUID();
			const fingerprint = inputFingerprint(canonicalInput);
			const expiresAtMs = Date.now() + 120_000;
			const allowOnce = !(
				process.platform === 'win32' &&
				resolution.grants.some((grant) => grant.kind === 'exec') &&
				resolution.reason === 'outside_trusted_location'
			);
			yield {
				type: 'tool_permission_request',
				approvalId,
				toolCallId: toolCall.id,
				toolName: toolCall.name,
				input: redactApprovalInput(canonicalInput, toolCall.name),
				mode: 'ask',
				targets: resolution.approvalTargets,
				reason: resolution.reason ?? 'outside_trusted_location',
				persistable,
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
				(decision === 'approve' && !allowOnce) || (decision === 'approve_always' && !persistable)
					? 'reject'
					: decision;
			permissionOutcome = effectiveDecision;
			if (effectiveDecision === 'approve_always' && mcpPolicy) {
				const profile = security.toolProfile ?? 'chat';
				setToolProfileTool(profile, mcpPolicy, {
					...getToolConfiguration(profile, mcpPolicy),
					permission: 'allow',
				});
			}
			if (effectiveDecision === 'approve_always' && resolution.persistable) {
				for (const grant of resolution.grants) {
					addPermissionRule(grant.kind, 'allow', { root: grant.root, recursive: true });
				}
			}
			permission = effectiveDecision === 'reject' ? 'deny' : 'allow';
		}
		permissionOutcome ??= permission;

		if (permission === 'deny') {
			output = `Error: permission denied for '${toolCall.name}'`;
			isError = true;
		} else if (exhausted()) {
			output = budgetError;
			isError = true;
		} else {
			try {
				if (signal?.aborted) throw signal.reason;
				hookedTool = {
					name: tool.name,
					description: tool.description,
					category: tool.category,
					source: tool.policy ?? { kind: 'builtin', id: tool.id },
				};
				await runPluginHooks('PRE_TOOL_USE', {
					agent: security.toolProfile ?? 'chat',
					runId: security.runId,
					toolCallId: toolCall.id,
					toolName: toolCall.name,
					tool: hookedTool,
					input: canonicalInput,
				});
				const release = resources
					? await resources.acquire(accessTargets, signal)
					: () => undefined;
				const timeoutController = new AbortController();
				let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
				let abort: (() => void) | undefined;
				let execution: Promise<unknown> | undefined;
				const toolSignal = signal
					? AbortSignal.any([signal, timeoutController.signal])
					: timeoutController.signal;
				try {
					timeoutTimer = setTimeout(
						() => timeoutController.abort(new DOMException('Tool call timed out.', 'TimeoutError')),
						tool.timeoutMs
					);
					timeoutTimer.unref?.();
					toolSignal.throwIfAborted();
					if (permissionOutcome === 'allow') access = captureAccess(accessTargets);
					const current = checkPermission();
					if (
						current.mode === 'deny' ||
						(permissionOutcome === 'allow' && current.mode !== 'allow')
					)
						throw new Error('Permission changed before execution.');
					const aborted = new Promise<never>((_, reject) => {
						abort = () => reject(toolSignal.reason ?? new Error('Tool call aborted.'));
						toolSignal.addEventListener('abort', abort, { once: true });
					});
					const historyTargets = ['write', 'edit', 'patch'].includes(toolCall.name)
						? (toolAccess.write ?? []).map(realPath)
						: [];
					const before = historyTargets.length > 0 ? captureFiles(historyTargets) : [];
					const run = (): Promise<unknown> =>
						executionScope.run(scope, () =>
							authorizedPaths.run(access, () =>
								Promise.resolve(tool.run(canonicalInput, toolSignal))
							)
						);
					const approvedRoots =
						permissionOutcome === 'approve'
							? resolution.grants.filter((grant) => grant.kind === 'exec').map((grant) => grant.root)
							: [];
					execution = Promise.resolve()
						.then(() => {
							toolSignal.throwIfAborted();
							return approvedExecRoots.run(approvedRoots, run);
						})
						.then((value) => {
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
							return value;
						})
						.finally(release);
					output = await Promise.race([execution, aborted]);
					output = limitToolOutput(output, tool.maxOutputBytes);
					authorizationRequired = mcpAuthorizationRequired(tool, output);
					if (authorizationRequired) {
						output = `Authentication required for ${authorizationRequired.serverName}.`;
						isError = true;
					}
					if (toolCall.name === 'read' && state) rememberTool(context, state);
					if (createsFile && state) rememberTool(context, state);
				} finally {
					if (!execution) release();
					clearTimeout(timeoutTimer);
					if (abort) toolSignal.removeEventListener('abort', abort);
				}
			} catch (error) {
				if (signal?.aborted) {
					abortError = { reason: error };
					output = 'Cancelled; an in-flight effect may still be settling.';
				} else {
					const message = error instanceof Error ? error.message : String(error);
					output = `Error: tool '${toolCall.name}' failed: ${message}`;
				}
				isError = true;
			}
		}
	}

	toolCall.result = {
		content: untrusted(tool, formatToolOutput(output)),
		isError,
		...(authorizationRequired ? { authorizationRequired } : {}),
	};

	toolCall.durationMs = Date.now() - startedAtMs;
	if (hookedTool) {
		void runPluginHooks('POST_TOOL_USE', {
			agent: security.toolProfile ?? 'chat',
			runId: security.runId,
			toolCallId: toolCall.id,
			toolName: toolCall.name,
			tool: hookedTool,
			input: canonicalInput,
			output: toolCall.result.content,
			isError: Boolean(isError),
			durationMs: toolCall.durationMs,
		});
	}

	security.budget?.observeOutput(Buffer.byteLength(formatToolOutput(output), 'utf8'));
	yield {
		type: 'tool_call_end',
		toolCallId: toolCall.id,
		toolName: toolCall.name,
		input: canonicalInput,
		output,
		isError,
		durationMs: toolCall.durationMs,
		...(permissionOutcome ? { permissionOutcome } : {}),
	};
	if (abortError) throw abortError.reason;
}
