import { getResolvedProvider } from '../../settings_store';
import { getModelId, getModelOptions, getProviderId } from '../agent_store';
import {
	addAssistantMessage,
	addToolResults,
	isExhausted,
	recordTurn,
	tryAppendRun,
	toResult,
	type SessionState,
	persist,
	sessionDir,
} from '../session';
import { goalContext } from '../goal/context';
import { goalTools } from '../goal/tools';
import { readGoal } from '../goal/read';
import { rememberSkill } from '../context';
import {
	buildLoadedSkillPrompt,
	buildSkillContext,
	buildSystemPrompt,
	buildWorkspaceContext,
	resolveContextMode,
} from '../system';
import { loadMcpTools } from '../tools/mcp/loader';
import { listSkillsTool } from '../tools/skills/list_skills';
import { loadSkillTool } from '../tools/skills/load_skill';
import { subagentTool, subagentsTool } from '../tools/core/subagents';
import type { Config, McpDiscoveryDiagnostics, RuntimeEvent, RuntimeInput, Tool } from '../types';
import type { WindowFactory } from '../../window_factory';
import { runModelTurn } from './run_model_turn';
import { runToolCalls } from './run_tool_calls';
import { filterTools } from './run_tools';
import { selectSkillTools } from './run_skill_tools';
import { activateSkill, createSkillRegistrySnapshot } from '../skills';
import type { SkillLoadResult } from '../../../shared/skills_types';
import type { KeyedLimiter } from '../limiter';
import type { KeyedMutex } from '../mutex';
import type { ExecSandbox } from '../sandbox';
import { builtinTools } from './run_builtin_tools';
import { undoFileTool } from '../tools/core/undo';
import { redoFileTool } from '../tools/core/redo';
import { addPlanPrompt } from '../plan/context';
import { isPlanOutputValid } from '../plan/output';
import { filterPlanTools } from '../plan/tools';
import { projectPromptAttachments, resolvePromptInputCapabilities } from '../attachments';
import { createBackgroundBrowser } from '../tools/web/browser/background';
import { ExecutionBudget } from '../execution/budget';

export interface StreamOptions {
	tools?: Tool[];
	instructions?: string;
	streaming?: boolean;
	windowFactory?: WindowFactory;
	resources?: KeyedMutex;
	providerLimiter?: KeyedLimiter;
	subagentLimiter?: KeyedLimiter;
	budget?: ExecutionBudget;
	sandbox?: ExecSandbox;
}

const MAX_TOOL_CALLS = 100;
const MAX_TOOL_OUTPUT_BYTES = 2_000_000;
const MAX_PAID_TOOL_CALLS = 3;
const MAX_BOT_WEB_TOOL_CALLS = 8;
const BACKGROUND_RECORDER_IDS = new Set(['microphone_recorder', 'screen_recorder']);

function startsBackgroundRecorder(call: import('../types').ToolCall): boolean {
	if (!BACKGROUND_RECORDER_IDS.has(call.name) || call.result?.isError) return false;
	if (typeof call.result?.content !== 'string') return false;
	try {
		const result = JSON.parse(call.result.content) as { id?: unknown };
		return typeof result.id === 'string' && result.id.length > 0;
	} catch {
		return false;
	}
}

export async function* stream(
	config: Config,
	session: SessionState,
	input: RuntimeInput,
	signal: AbortSignal,
	options: StreamOptions = {}
): AsyncGenerator<RuntimeEvent> {
	let terminal = false;
	const browser =
		input.type === 'background' && input.agentId !== 'channels' && input.scope?.source !== 'channel'
			? createBackgroundBrowser()
			: undefined;
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
			terminal = true;
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
		terminal = true;
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
	const provider = getResolvedProvider(input.providerId ?? getProviderId());
	const modelId = input.model ?? getModelId();
	const modelOptions = getModelOptions();
	const runId = input.runId ?? session.id;
	const budget = options.budget ?? new ExecutionBudget({
		calls: MAX_TOOL_CALLS,
		paid: MAX_PAID_TOOL_CALLS,
		output: MAX_TOOL_OUTPUT_BYTES,
		...(input.agentId === 'channels' ? { web: MAX_BOT_WEB_TOOL_CALLS } : {}),
	});
	const skillLoadingEnabled =
		(input.toolsAllow === undefined || input.toolsAllow.includes('load_skill')) &&
		!input.toolsDeny?.includes('load_skill');
	const skillListingEnabled =
		(input.toolsAllow === undefined || input.toolsAllow.includes('list_skills')) &&
		!input.toolsDeny?.includes('list_skills');
	const skillSnapshot =
		skillLoadingEnabled || skillListingEnabled
			? createSkillRegistrySnapshot()
			: { skills: [], diagnostics: [] };

	if (!provider || !modelId) throw new Error('Agent requires a configured provider and model.');
	const promptCapabilities =
		input.promptCapabilities ?? resolvePromptInputCapabilities(provider.id, modelId);

	if (!options.tools && !options.sandbox) throw new Error('Agent command sandbox is unavailable.');
	const contextMode = await resolveContextMode(
		config,
		input.contextMode,
		session.category,
		input.interactionMode,
		options.instructions !== undefined
	);

	let tools: Tool[] = options.tools
		? [...options.tools]
		: builtinTools(config, options.sandbox!, options.windowFactory, input.interactionMode);
	if (backgroundBrowser)
		tools = tools.map((tool) => (tool.id === backgroundBrowser.id ? backgroundBrowser : tool));
	if (!options.tools && input.interactionMode !== 'plan') {
		tools.push(
			undoFileTool(session.runContext.fileHistory),
			redoFileTool(session.runContext.fileHistory)
		);
	}
	if (
		!options.tools &&
		session.category === 'main' &&
		input.interactionMode !== 'plan' &&
		session.folderName !== '' &&
		readGoal(sessionDir(session))?.status === 'active'
	) {
		tools.push(...goalTools(sessionDir(session)));
	}
	tools = filterPlanTools(tools, input.interactionMode);
	const applyActivatedSkill = (skill: SkillLoadResult): void => {
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
		tools.splice(
			0,
			tools.length,
			...filterPlanTools(
				filterTools(selectSkillTools(tools, skill.allowedTools), input.toolsAllow, input.toolsDeny),
				input.interactionMode
			)
		);
	};
	if (!options.tools && skillListingEnabled) tools.push(listSkillsTool(skillSnapshot));
	if (!options.tools && skillLoadingEnabled) {
		const activationTool = loadSkillTool(skillSnapshot, applyActivatedSkill);
		if (activationTool) tools.push(activationTool);
	}

	let closeMcp: (() => Promise<void>) | undefined;
	let mcpDiscovery: McpDiscoveryDiagnostics | undefined;
	if (!options.tools) {
		if (
			input.interactionMode !== 'plan' &&
			(input.toolsAllow === undefined ||
				input.toolsAllow.some((toolId) => toolId.startsWith('mcp__')))
		) {
			const mcp = await loadMcpTools(signal);
			tools.push(...mcp.tools);
			closeMcp = mcp.close;
			mcpDiscovery = mcp.diagnostics;
		}
		const childTools = filterTools(tools, input.toolsAllow, input.toolsDeny).filter(
			(tool) =>
				tool.id !== 'use_web_browser' ||
				(input.agentId !== 'channels' && input.scope?.source !== 'channel')
		);
		const childRuntime = {
			type: input.type,
			interactionMode: input.interactionMode,
			...(options.resources ? { resources: options.resources } : {}),
			...(options.providerLimiter ? { providerLimiter: options.providerLimiter } : {}),
			...(options.subagentLimiter ? { subagentLimiter: options.subagentLimiter } : {}),
			budget,
			providerId: provider.id,
			model: modelId,
			...(input.effort ? { effort: input.effort } : {}),
			...(promptCapabilities ? { promptCapabilities } : {}),
			...(input.scope ? { scope: input.scope } : {}),
		};
		tools.push(
			subagentTool(config, childTools, childRuntime),
			subagentsTool(config, childTools, childRuntime, options.subagentLimiter)
		);
	}
	tools = filterTools(tools, input.toolsAllow, input.toolsDeny);
	tools = filterPlanTools(tools, input.interactionMode);
	if (input.explicitSkill && !skillLoadingEnabled)
		throw new Error('Skill loading is unavailable for this run.');
	if (input.explicitSkill)
		applyActivatedSkill(await activateSkill(skillSnapshot, input.explicitSkill));

	yield {
		type: 'run_started',
		sessionId: session.id,
		interactionMode: input.interactionMode,
		model: modelId,
		providerId: provider.id,
		tools: tools.map((tool) => tool.id),
		skillDiagnostics: skillSnapshot.diagnostics,
		skillActivations: session.runContext.loadedSkills.map((skill) => ({
			id: skill.id,
			name: skill.name,
			hash: skill.hash,
			trust: skill.trust,
		})),
		...(mcpDiscovery ? { mcpDiscovery } : {}),
	};

	try {
		while (true) {
			if (signal.aborted) return;
			const systemPrompt = await buildSystemPrompt(
				config,
				tools,
				session.runContext.loadedSkills,
				options.instructions,
				contextMode,
				tools.some((tool) => tool.id === 'load_skill')
			);
			const loadedSkillPrompt = buildLoadedSkillPrompt(session.runContext.loadedSkills);
			const protectedSkillPrompt =
				input.interactionMode === 'plan' ? addPlanPrompt(loadedSkillPrompt) : loadedSkillPrompt;
			const workspaceContext =
				contextMode === 'workspace' && options.instructions === undefined
					? await buildWorkspaceContext(config)
					: '';
			const skillContext = tools.some((tool) => tool.id === 'load_skill')
				? buildSkillContext(skillSnapshot.skills)
				: '';
			const activeGoalContext =
				session.category === 'main' && input.interactionMode !== 'plan' && session.folderName !== ''
					? goalContext(sessionDir(session))
					: '';
			const runtimeContext = [workspaceContext, skillContext, activeGoalContext]
				.filter(Boolean)
				.join('\n\n');
			const messages = promptCapabilities
				? projectPromptAttachments(session.messages, promptCapabilities)
				: session.messages;
			const turn = yield* runModelTurn(
				input,
				provider,
				modelId,
				systemPrompt,
				messages,
				tools,
				signal,
				modelOptions,
				undefined,
				protectedSkillPrompt,
				runtimeContext ? [{ role: 'user', content: runtimeContext }] : [],
				options.streaming ?? true,
				options.providerLimiter,
				input.deferPersist ? () => persist(session) : undefined,
				budget
			);

			recordTurn(session, turn);
			if (
				turn.toolCalls.length === 0 &&
				input.interactionMode === 'plan' &&
				!isPlanOutputValid(turn.content)
			) {
				throw new Error(
					'Plan response must contain exactly one non-empty <proposed_plan> envelope and no other text.'
				);
			}

			yield {
				type: 'assistant_message',
				content: turn.content,
				toolCalls: turn.toolCalls,
			};
			addAssistantMessage(session, turn.content, turn.toolCalls, turn.providerItems, {
				inputTokens: turn.usage?.inputTokens ?? 0,
				outputTokens: turn.usage?.outputTokens ?? 0,
			});

			if (turn.toolCalls.length === 0) {
				const result = toResult(session, 'success');
				yield { type: 'run_finished', result };
				return;
			}
			if (budget.wouldExceed(turn.toolCalls.map((call) => ({
				tool: tools.find((tool) => tool.id === call.name),
				input: call.args,
			})))) {
				budget.exhausted = true;
				session.stopReason = 'budget_exhausted';
				yield { type: 'run_finished', result: toResult(session, 'success') };
				return;
			}

			if (isExhausted(session)) {
				session.stopReason = 'max_iterations';
				const result = toResult(session, 'error_max_turns');
				yield { type: 'run_finished', result };
				return;
			}

			for await (const event of runToolCalls(
				tools,
				turn.toolCalls,
				signal,
				session.runContext.fileAccess,
				{
					runId,
					...(input.scope ? { scope: input.scope } : {}),
					budget,
					interactionMode: input.interactionMode,
					...(input.approvalWindowId === undefined ? {} : { windowId: input.approvalWindowId }),
				},
				options.resources,
				session.runContext.fileHistory
			)) {
				yield event;
			}
			addToolResults(session, turn.toolCalls);
			if (turn.toolCalls.some(startsBackgroundRecorder)) {
				yield { type: 'run_finished', result: toResult(session, 'success') };
				return;
			}
			if (budget.exhausted) {
				session.stopReason = 'budget_exhausted';
				yield { type: 'run_finished', result: toResult(session, 'success') };
				return;
			}
		}
	} finally {
		await closeMcp?.();
	}
}
