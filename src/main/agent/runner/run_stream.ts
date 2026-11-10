import type { MemoryService } from '../../../shared/memory_types';
import { getResolvedProvider } from '../../settings_store';
import { getToolConfiguration } from '../agent_store';
import { getAgentProfileModel } from '../agent_profiles';
import {
	addAssistantMessage,
	addToolResults,
	addUserMessage,
	isExhausted,
	recordTurn,
	tryAppendRun,
	toResult,
	type SessionState,
	persist,
	persistSystemPrompt,
} from '../session';
import { rememberSkill } from '../context';
import {
	buildLoadedSkillPrompt,
	buildSystemPrompt,
	buildWorkspaceContext,
	resolveContextMode,
} from '../system';
import { loadMcpTools } from '../tools/mcp/loader';
import { requestMcpAuthorizationTool } from '../tools/mcp/authorize';
import { testMcpServer } from '../../mcp';
import { listSkillsTool } from '../tools/skills/list_skills';
import { loadSkillTool } from '../tools/skills/load_skill';
import { subagentTool, subagentsTool } from '../tools/core/subagents';
import type {
	Config,
	McpDiscoveryDiagnostics,
	RuntimeEvent,
	RuntimeInput,
	Tool,
	ToolCall,
} from '../types';
import { runModelTurn } from './run_model_turn';
import { runToolCalls } from './run_tool_calls';
import { runMcpRecovery } from './run_mcp_recovery';
import { mcpAuthorizationStopped } from './mcp_authorization_stopped';
import { filterProfileTools, filterTools } from './run_tools';
import { isAgentToolAllowedForProfile } from '../../../shared/agent_tools';
import { selectSkillTools } from './run_skill_tools';
import { activateSkill, createSkillRegistrySnapshot } from '../skills';
import type { SkillLoadResult } from '../../../shared/skills_types';
import type { KeyedLimiter } from '../limiter';
import type { KeyedMutex } from '../mutex';
import type { ExecSandbox } from '../sandbox';
import { builtinTools } from './run_builtin_tools';
import { undoFileTool } from '../tools/core/undo';
import { redoFileTool } from '../tools/core/redo';
import type { RunStop } from '../extension';
import { projectPromptAttachments, resolvePromptInputCapabilities } from '../attachments';
import { createBackgroundBrowser } from '../tools/web/browser/background';
import { ExecutionBudget } from '../execution/budget';
import { skipToolCalls } from './skip';
import { startsBackgroundRecorder } from './recorder';
import { createToolSearch, TOOL_SEARCH_ID, type ToolSearch } from './run_discovery';
import path from 'node:path';
import { agentLocation } from '../../shared/agent_location';
import { profileStatus } from '../system/system_profile_status';
import { completeBootstrapTool } from '../tools/assistant/complete_bootstrap';
import { updateIdentityTool } from '../tools/identity/update';
import { updateSoulTool } from '../tools/soul/update';
import { updateUserTool } from '../tools/user/update';
import { requestsSkillTools } from './run_skill_request';
import { resolveMcpServerHint } from './run_mcp_hint';
import { requestedTaskTools } from './run_task_request';

export interface StreamOptions {
	tools?: Tool[];
	memory?: MemoryService;
	instructions?: string;
	streaming?: boolean;
	resources?: KeyedMutex;
	providerLimiter?: KeyedLimiter;
	subagentLimiter?: KeyedLimiter;
	budget?: ExecutionBudget;
	modelOptions?: Record<string, unknown>;
	sandbox?: ExecSandbox;
	progressiveDiscovery?: boolean;
}

const MAX_TOOL_CALLS = 100;
const MAX_TOOL_OUTPUT_BYTES = 2_000_000;
const MAX_PAID_TOOL_CALLS = 3;
export async function* stream(
	config: Config,
	session: SessionState,
	input: RuntimeInput,
	signal: AbortSignal,
	options: StreamOptions = {}
): AsyncGenerator<RuntimeEvent> {
	let terminal = false;
	const browser = input.type === 'background' ? createBackgroundBrowser() : undefined;
	try {
		for await (const event of loop(config, session, input, signal, options, browser?.tool)) {
			tryAppendRun(session, event);
			yield event;
			if (event.type === 'run_finished') terminal = true;
		}
	} catch (error) {
		const errorEvent = {
			type: 'run_error',
			message: error instanceof Error ? error.message : String(error),
		} as const;
		tryAppendRun(session, errorEvent);
		yield errorEvent;
		if (!terminal) {
			session.stopReason = signal.aborted
				? signal.reason instanceof DOMException && signal.reason.name === 'TimeoutError'
					? 'timeout'
					: 'cancelled'
				: 'error';
			const event = { type: 'run_finished', result: toResult(session, 'success') } as const;
			tryAppendRun(session, event);
			yield event;
		}
		if (!signal.aborted) throw error;
		return;
	} finally {
		await browser?.close();
	}
	if (!terminal) {
		session.stopReason = signal.aborted
			? signal.reason instanceof DOMException && signal.reason.name === 'TimeoutError'
				? 'timeout'
				: 'cancelled'
			: 'error';
		const event = { type: 'run_finished', result: toResult(session, 'success') } as const;
		tryAppendRun(session, event);
		yield event;
	}
}

async function* loop(
	config: Config,
	session: SessionState,
	input: RuntimeInput,
	signal: AbortSignal,
	options: StreamOptions,
	backgroundBrowser?: Tool
): AsyncGenerator<RuntimeEvent> {
	const selectedModel = getAgentProfileModel(input.toolProfile ?? 'chat', 'textToText');
	const provider = getResolvedProvider(input.providerId ?? selectedModel.providerId);
	const modelId = input.model ?? selectedModel.modelId;
	const modelOptions = options.modelOptions ?? structuredClone(selectedModel.options);
	const runId = input.runId ?? session.id;
	const budget =
		options.budget ??
		new ExecutionBudget({
			calls: MAX_TOOL_CALLS,
			paid: MAX_PAID_TOOL_CALLS,
			output: MAX_TOOL_OUTPUT_BYTES,
		});
	const toolProfile = input.toolProfile ?? 'chat';
	const extension = input.extension;
	const restricted = extension?.restricted === true;
	const ask = input.approvalWindowId !== undefined && extension?.ask !== false;
	let mcpServerHint: string | undefined;
	const bootstrap =
		!options.tools &&
		session.category === 'main' &&
		!restricted &&
		path.resolve(config.location) === path.resolve(agentLocation()) &&
		(await profileStatus(config.location)).missing.length > 0;
	const filterRuntimeTools = (candidates: Tool[]): Tool[] =>
		filterProfileTools(candidates, toolProfile).filter((tool) =>
			isAgentToolAllowedForProfile(toolProfile, tool.policy ?? { kind: 'builtin', id: tool.id })
		);
	const toolIdEnabled = (id: string): boolean =>
		!bootstrap &&
		(input.toolsAllow === undefined || input.toolsAllow.includes(id)) &&
		!input.toolsDeny?.includes(id) &&
		getToolConfiguration(toolProfile, { kind: 'builtin', id }).permission !== 'deny' &&
		isAgentToolAllowedForProfile(toolProfile, { kind: 'builtin', id });
	const skillToolsRequested = requestsSkillTools(input.message, input.explicitSkill);
	const taskToolIds = requestedTaskTools(input.message);
	const skillLoadingEnabled = skillToolsRequested && toolIdEnabled('load_skill');
	const skillListingEnabled = skillToolsRequested && toolIdEnabled('list_skills');
	const searchEnabled = toolIdEnabled('tool_search');
	const skillSnapshot =
		skillLoadingEnabled || skillListingEnabled
			? createSkillRegistrySnapshot({ projectRoot: config.location })
			: { skills: [], diagnostics: [] };

	if (!provider || !modelId) throw new Error('Agent requires a configured provider and model.');
	const promptCapabilities =
		input.promptCapabilities ?? resolvePromptInputCapabilities(provider.id, modelId);

	if (!options.tools && !options.sandbox) throw new Error('Agent command sandbox is unavailable.');
	const contextMode = await resolveContextMode(
		config,
		input.contextMode,
		session.category,
		restricted,
		options.instructions !== undefined
	);

	let tools: Tool[] = options.tools
		? [...options.tools]
		: bootstrap
			? [updateIdentityTool, updateSoulTool, updateUserTool, completeBootstrapTool]
			: builtinTools(config, options.sandbox!, {
					ask,
					readOnlyShell: extension?.readOnlyShell === true,
					restricted,
				});
	if (backgroundBrowser)
		tools = tools.map((tool) => (tool.id === backgroundBrowser.id ? backgroundBrowser : tool));
	if (!options.tools && !bootstrap && !restricted) {
		tools.push(
			undoFileTool(session.runContext.fileHistory),
			redoFileTool(session.runContext.fileHistory)
		);
	}
	const extended = !options.tools && !bootstrap;
	const extensionTools = extended ? (extension?.tools ?? []) : [];
	const skillToolScopes: Array<string[] | undefined> = [];
	const filterEligibleTools = (candidates: Tool[]): Tool[] => {
		let filtered = filterRuntimeTools(
			filterTools(candidates, input.toolsAllow, input.toolsDeny).filter(
				(tool) => !extension || extension.allows(tool)
			)
		);
		for (const allowedTools of skillToolScopes) filtered = selectSkillTools(filtered, allowedTools);
		return filtered;
	};
	tools = filterEligibleTools(tools);
	let search: ToolSearch | undefined;
	const applyActivatedSkill = (skill: SkillLoadResult): void => {
		skillToolScopes.push(skill.allowedTools);
		rememberSkill(session.runContext, {
			id: skill.id,
			name: skill.name,
			canonicalRoot: skill.canonicalRoot,
			instructions: skill.instructions,
			trust: skill.trust,
			hash: skill.hash,
			resources: skill.resources,
			warnings: skill.warnings,
		});
		tools = filterEligibleTools(tools);
		search?.replaceEligible(filterEligibleTools(tools));
	};
	if (!options.tools && skillListingEnabled) tools.push(listSkillsTool(skillSnapshot));
	if (!options.tools && skillLoadingEnabled) {
		const activationTool = loadSkillTool(skillSnapshot, applyActivatedSkill);
		if (activationTool) tools.push(activationTool);
	}

	let closeMcp: (() => Promise<void>) | undefined;
	let mcpDiscovery: McpDiscoveryDiagnostics | undefined;
	let mcpEntries: import('./run_discovery').DiscoveredMcpTool[] = [];
	let uncatalogedMcp: Array<{ serverId: string; serverName: string }> = [];
	try {
		if (!options.tools) {
			if (
				!bootstrap &&
				!restricted &&
				(input.toolsAllow === undefined ||
					input.toolsAllow.some((toolId) => toolId.startsWith('mcp__')))
			) {
				const mcp = await loadMcpTools(signal);
				tools.push(...mcp.tools);
				mcpEntries = mcp.entries;
				uncatalogedMcp = mcp.uncataloged ?? [];
				closeMcp = mcp.close;
				mcpDiscovery = mcp.diagnostics;
			}
			mcpServerHint = resolveMcpServerHint(input.message, [
				...mcpEntries.map(({ serverId, serverName }) => ({ serverId, serverName })),
				...uncatalogedMcp,
			]);
			const childTools = filterEligibleTools(tools).filter((tool) => tool.id !== 'ask');
			const childRuntime = {
				type: input.type,
				...(extension ? { extension: extension.child() } : {}),
				...(options.resources ? { resources: options.resources } : {}),
				...(options.providerLimiter ? { providerLimiter: options.providerLimiter } : {}),
				...(options.subagentLimiter ? { subagentLimiter: options.subagentLimiter } : {}),
				budget,
				modelOptions,
				providerId: provider.id,
				model: modelId,
				...(input.effort ? { effort: input.effort } : {}),
				...(promptCapabilities ? { promptCapabilities } : {}),
				...(input.scope ? { scope: input.scope } : {}),
				toolProfile,
			};
			if (!bootstrap)
				tools.push(
					subagentTool(config, childTools, childRuntime),
					subagentsTool(config, childTools, childRuntime, options.subagentLimiter)
				);
			tools.push(...extensionTools);
		}
		if (options.tools)
			mcpServerHint = resolveMcpServerHint(
				input.message,
				tools.flatMap((tool) =>
					tool.policy?.kind === 'mcp'
						? [{ serverId: tool.policy.serverId, serverName: tool.policy.serverId }]
						: []
				)
			);
		tools = filterEligibleTools(tools);
		if (!bootstrap && (!options.tools || options.progressiveDiscovery === true)) {
			const requiredIds = new Set([
				...taskToolIds,
				'read',
				'write',
				'edit',
				'patch',
				'bash',
				'search_web',
				'fetch_web_page',
				'undo',
				'redo',
				'complete_bootstrap',
				'update_identity',
				'update_soul',
				'update_user',
				'subagent',
				'subagents',
				'load_script',
				'run_script',
				...(ask ? ['ask'] : []),
				...extensionTools.map((tool) => tool.id),
				...(skillListingEnabled ? ['list_skills'] : []),
				...(skillLoadingEnabled ? ['load_skill'] : []),
			]);
			search = createToolSearch({
				eligible: filterEligibleTools(tools),
				required: mcpServerHint
					? []
					: filterEligibleTools(tools).filter((tool) => requiredIds.has(tool.id)),
				discoveryEnabled: searchEnabled,
				mcpTools: mcpEntries,
				mcpServerHint,
				filterEligible: filterEligibleTools,
			});
		}
		if (input.explicitSkill && !skillLoadingEnabled)
			throw new Error('Skill loading is unavailable for this run.');
		if (input.explicitSkill) {
			const skill = await activateSkill(skillSnapshot, input.explicitSkill);
			applyActivatedSkill(skill);
		}

		yield {
			type: 'run_started',
			sessionId: session.id,
			modeIds: session.modeIds ?? [],
			model: modelId,
			providerId: provider.id,
			tools: (search?.active() ?? tools).map((tool) => tool.id),
			skillDiagnostics: skillSnapshot.diagnostics,
			skillActivations: session.runContext.loadedSkills.map((skill) => ({
				id: skill.id,
				name: skill.name,
				hash: skill.hash,
				trust: skill.trust,
			})),
			...(mcpDiscovery ? { mcpDiscovery } : {}),
		};
		const requestedUncatalogedMcp = uncatalogedMcp.find(
			(server) =>
				server.serverId.toLocaleLowerCase() === mcpServerHint ||
				server.serverName.toLocaleLowerCase() === mcpServerHint
		);
		if (
			requestedUncatalogedMcp &&
			input.approvalWindowId !== undefined &&
			!restricted
		) {
			const authorizationCall: ToolCall = {
				id: crypto.randomUUID(),
				name: 'request_mcp_authorization',
				args: { serverId: requestedUncatalogedMcp.serverId },
			};
			for await (const event of runToolCalls(
				[requestMcpAuthorizationTool()],
				[authorizationCall],
				signal,
				session.runContext.fileAccess,
				{
					runId,
					budget,
					...(extension ? { extension } : {}),
					toolProfile,
					windowId: input.approvalWindowId,
				},
				options.resources,
				session.runContext.fileHistory
			))
				yield event;
			const result = authorizationCall.result?.content;
			let authorizationStatus: string | undefined;
			try {
				authorizationStatus =
					typeof result === 'string'
						? (JSON.parse(result) as { status?: string }).status
						: undefined;
			} catch {
				authorizationStatus = undefined;
			}
			if (authorizationStatus !== 'authorized' && authorizationStatus !== 'already_authorized') {
				session.stopReason = authorizationStatus === 'cancelled' ? 'cancelled' : 'error';
				yield { type: 'run_finished', result: toResult(session, 'success') };
				return;
			}
			if (authorizationStatus === 'already_authorized') {
				const listed = await testMcpServer(requestedUncatalogedMcp.serverId);
				if (!listed.ok) throw new Error(listed.error ?? 'Failed to load MCP tools.');
			}
			if (authorizationStatus === 'authorized' || authorizationStatus === 'already_authorized') {
				await closeMcp?.();
				const refreshed = await loadMcpTools(signal);
				tools = [...tools.filter((tool) => tool.policy?.kind !== 'mcp'), ...refreshed.tools];
				mcpEntries = refreshed.entries;
				closeMcp = refreshed.close;
				mcpDiscovery = refreshed.diagnostics;
				search?.replaceMcpEntries(mcpEntries);
				search?.replaceEligible(filterEligibleTools(tools));
				if (!mcpEntries.some((entry) => entry.serverId === requestedUncatalogedMcp.serverId))
					throw new Error(
						`${requestedUncatalogedMcp.serverName} did not provide any MCP tools after authorization.`
					);
			}
		}

		let finalization: { instruction: string; stopReason?: string } | undefined;
		let continued = false;
		let nudges = 3;
		while (true) {
			if (signal.aborted) return;
			const synthesisOnly = finalization !== undefined || budget.isSynthesisOnly();
			const turnTools = synthesisOnly ? [] : (search?.active() ?? tools);
			const eligibleTurnTools =
				synthesisOnly || !turnTools.some((tool) => tool.id === TOOL_SEARCH_ID)
					? turnTools
					: (search?.eligible() ?? tools);
			let systemPrompt = await buildSystemPrompt(
				config,
				turnTools,
				session.runContext.loadedSkills,
				options.instructions,
				contextMode,
				turnTools.some((tool) => tool.id === 'load_skill'),
				eligibleTurnTools
			);
			const loadedSkillPrompt = buildLoadedSkillPrompt(session.runContext.loadedSkills);
			const protectedSkillPrompt = [
				loadedSkillPrompt,
				extension?.protectedPrompt,
				finalization?.instruction,
				synthesisOnly
					? 'Provide a non-empty final answer using the available results. Do not call tools or claim unexecuted actions succeeded.'
					: '',
			]
				.filter(Boolean)
				.join('\n\n');
			const memoryContext =
				session.category === 'main' && options.memory?.getConfig().includeInPrompt
					? await options.memory.read().catch(() => '')
					: '';
			const workspaceContext = await buildWorkspaceContext(
				config,
				contextMode === 'workspace' || session.category === 'main' ? 'full' : 'core',
				memoryContext
			);
			systemPrompt += `\n\n${workspaceContext}`;
			if (extension?.prompt) systemPrompt += `\n\n${extension.prompt}`;
			const extensionContext = extended ? extension?.context() : '';
			if (extensionContext) systemPrompt += `\n\n${extensionContext}`;
			const messages = promptCapabilities
				? projectPromptAttachments(session.messages, promptCapabilities)
				: session.messages;
			const turn = yield* runModelTurn(
				input,
				provider,
				modelId,
				systemPrompt,
				messages,
				turnTools,
				signal,
				modelOptions,
				undefined,
				protectedSkillPrompt,
				[],
				options.streaming ?? true,
				options.providerLimiter,
				(acceptedSystemPrompt) => {
					persistSystemPrompt(session, acceptedSystemPrompt ?? '');
					if (input.deferPersist) persist(session);
				},
				budget,
				[]
			);

			if (synthesisOnly && (turn.toolCalls.length > 0 || !turn.content.trim())) {
				recordTurn(session, turn);
				if (turn.toolCalls.length > 0) {
					addAssistantMessage(session, turn.content, turn.toolCalls, turn.providerItems);
					yield* skipToolCalls(
						turn.toolCalls,
						'Final answer required; this action was not executed.'
					);
					addToolResults(session, turn.toolCalls);
				}
				throw new Error('Agent did not produce a non-empty final answer without tool calls.');
			}
			if (turn.toolCalls.length === 0 && !turn.content.trim()) {
				recordTurn(session, turn);
				finalization = {
					instruction: 'The previous model response was empty. Answer the user now.',
				};
				continue;
			}
			const stop: ModeStop =
				turn.toolCalls.length === 0
					? modeStop(turn.content, mode, statefulModes, stateDirectory, startedAt, {
							retry: !finalization,
							continue: !synthesisOnly && !continued && nudges > 0 && !isExhausted(session),
						})
					: { kind: 'accept' };
			if (stop.kind === 'retry') {
				recordTurn(session, turn);
				finalization = { instruction: stop.instruction };
				continue;
			}
			if (stop.kind === 'continue') {
				recordTurn(session, turn);
				yield { type: 'assistant_message', content: turn.content, toolCalls: turn.toolCalls };
				addAssistantMessage(session, turn.content, turn.toolCalls, turn.providerItems, {
					context: turn.usage?.context,
					inputTokens: turn.usage?.inputTokens ?? 0,
					outputTokens: turn.usage?.outputTokens ?? 0,
				});
				addUserMessage(session, [{ type: 'text', internal: true, text: stop.message }]);
				continued = true;
				nudges -= 1;
				continue;
			}
			continued = false;

			if (turn.toolCalls.length === 0) {
				recordTurn(session, turn);
				yield {
					type: 'assistant_message',
					content: turn.content,
					toolCalls: turn.toolCalls,
				};
				addAssistantMessage(session, turn.content, turn.toolCalls, turn.providerItems, {
					context: turn.usage?.context,
					inputTokens: turn.usage?.inputTokens ?? 0,
					outputTokens: turn.usage?.outputTokens ?? 0,
				});
				if (finalization?.stopReason) session.stopReason = finalization.stopReason;
				const result = toResult(
					session,
					finalization?.stopReason === 'max_iterations' ? 'error_max_turns' : 'success'
				);
				yield { type: 'run_finished', result };
				return;
			}
			recordTurn(session, turn);
			yield {
				type: 'assistant_message',
				content: turn.content,
				toolCalls: turn.toolCalls,
			};
			addAssistantMessage(session, turn.content, turn.toolCalls, turn.providerItems, {
				context: turn.usage?.context,
				inputTokens: turn.usage?.inputTokens ?? 0,
				outputTokens: turn.usage?.outputTokens ?? 0,
			});
			const pendingToolCalls = turn.toolCalls;
			const budgetExceeded = budget.wouldExceed(
				pendingToolCalls.map((call) => ({
					tool: turnTools.find((tool) => tool.id === call.name),
					input: call.args,
				}))
			);
			if (budgetExceeded || isExhausted(session)) {
				const stopReason = budgetExceeded ? 'budget_exhausted' : 'max_iterations';
				const instruction = budgetExceeded
					? 'Execution budget exhausted; remaining actions were not executed. Explain the available results and limitations.'
					: 'Turn limit reached; remaining actions were not executed. Explain the available results and limitations.';
				yield* skipToolCalls(pendingToolCalls, instruction);
				addToolResults(session, turn.toolCalls);
				if (budgetExceeded) {
					budget.exhausted = true;
					if (input.agentId === 'subagent') {
						session.stopReason = stopReason;
						yield { type: 'run_finished', result: toResult(session, 'success') };
						return;
					}
					budget.allowSynthesis();
				}
				finalization = { instruction, stopReason };
				continue;
			}

			if (pendingToolCalls.some((call) => call.name === 'tool_search')) {
				yield { type: 'capability_resolution_start' };
			}
			const security = {
				runId,
				...(input.scope ? { scope: input.scope } : {}),
				budget,
				mode,
				toolProfile,
				...(input.approvalWindowId === undefined ? {} : { windowId: input.approvalWindowId }),
			};
			for await (const event of runToolCalls(
				turnTools,
				pendingToolCalls,
				signal,
				session.runContext.fileAccess,
				security,
				options.resources,
				session.runContext.fileHistory,
				eligibleTurnTools
			)) {
				yield event;
			}
			const failedMcpCall = pendingToolCalls.find((call) => call.result?.authorizationRequired);
			if (
				failedMcpCall &&
				input.approvalWindowId !== undefined &&
				!mode.restricted
			) {
				const recovery = yield* runMcpRecovery({
					session,
					failedCall: failedMcpCall,
					failedTool: turnTools.find((tool) => tool.id === failedMcpCall.name),
					pendingCalls: pendingToolCalls,
					signal,
					context: session.runContext.fileAccess,
					security,
					resources: options.resources,
					history: session.runContext.fileHistory,
				});
				if (recovery === 'cancelled') {
					session.stopReason = 'cancelled';
					yield { type: 'run_finished', result: toResult(session, 'success') };
					return;
				}
				continue;
			}
			if (pendingToolCalls.some(mcpAuthorizationStopped)) {
				yield* skipToolCalls(
					pendingToolCalls.filter((call) => !call.result),
					'Authorization was not completed; remaining tools were not run.'
				);
				addToolResults(session, pendingToolCalls);
				session.stopReason = 'cancelled';
				yield { type: 'run_finished', result: toResult(session, 'success') };
				return;
			}
			if (pendingToolCalls.some((call) => call.name === 'tool_search')) {
				const serviceIds = new Set<string>();
				let discoveryLatencyMs: number | undefined;
				const selectedIds = new Set(
					pendingToolCalls.flatMap((call) => {
						if (call.name !== 'tool_search' || typeof call.result?.content !== 'string') return [];
						try {
							const parsed = JSON.parse(call.result.content) as {
								selectedToolIds?: unknown;
								selectedServiceIds?: unknown;
								latencyMs?: unknown;
							};
							if (Array.isArray(parsed.selectedServiceIds)) {
								for (const id of parsed.selectedServiceIds)
									if (typeof id === 'string') serviceIds.add(id);
							}
							if (typeof parsed.latencyMs === 'number') discoveryLatencyMs = parsed.latencyMs;
							return Array.isArray(parsed.selectedToolIds)
								? parsed.selectedToolIds.filter((id): id is string => typeof id === 'string')
								: [];
						} catch {
							return [];
						}
					})
				);
				yield {
					type: 'capability_resolution_result',
					serviceIds: [...serviceIds],
					...(discoveryLatencyMs === undefined ? {} : { latencyMs: discoveryLatencyMs }),
					tools: (search?.active() ?? tools)
						.filter((tool) => selectedIds.has(tool.id))
						.map((tool) => ({ id: tool.id, name: tool.name })),
				};
			}
			addToolResults(session, turn.toolCalls);
			if (budget.exhausted) {
				if (input.agentId === 'subagent') {
					session.stopReason = 'budget_exhausted';
					yield { type: 'run_finished', result: toResult(session, 'success') };
					return;
				}
				budget.allowSynthesis();
				finalization = {
					instruction: 'Execution budget exhausted. Explain the available results and limitations.',
					stopReason: 'budget_exhausted',
				};
			} else if (turn.toolCalls.some(startsBackgroundRecorder)) {
				finalization = {
					instruction:
						'Recording started in the background. Confirm its current status without waiting for completion or stopping it.',
				};
			}
		}
	} finally {
		await closeMcp?.();
	}
}
