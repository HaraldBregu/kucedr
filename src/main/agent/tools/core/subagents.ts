import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { KeyedLimiter } from '../../limiter';
import { stream, type StreamOptions } from '../../runner/run_stream';
import { createSessionState } from '../../session';
import type { Config, RuntimeInput, SessionResult, Tool } from '../../types';
import type { AgentRunType } from '../../../../shared/agent_types';
import type { AgentToolProfileId } from '../../../../shared/agent_tools';
import { tool } from '../tool';

export interface ChildRuntime extends Pick<
	StreamOptions,
	'resources' | 'providerLimiter' | 'subagentLimiter' | 'budget' | 'modelOptions'
> {
	type: AgentRunType;
	extension?: import('../../extension').RunExtension;
	providerId?: string;
	model?: string;
	effort?: RuntimeInput['effort'];
	promptCapabilities?: RuntimeInput['promptCapabilities'];
	scope?: RuntimeInput['scope'];
	toolProfile?: AgentToolProfileId;
}

export interface ChildOutcome {
	status: 'completed' | 'cancelled' | 'failed' | 'exhausted';
	text: string;
	stopReason?: string;
	usage?: SessionResult['usage'];
	error?: string;
	result?: {
		sessionId: string;
		model: string;
		subtype: SessionResult['subtype'];
		toolCalls: number;
		toolNames: string[];
	};
}

const CHILD_SUMMARY_MAX_CHARS = 12_000;

export async function runChild(
	config: Config,
	tools: Tool[],
	task: string,
	instructions: string,
	signal: AbortSignal,
	runtime: ChildRuntime
): Promise<ChildOutcome> {
	const runId = randomUUID();
	const baseInput = {
		runId,
		task: 'subagent',
		message: task,
		agentId: 'subagent',
		contextMode: 'minimal' as const,
		...(runtime.extension ? { extension: runtime.extension } : {}),
		...(runtime.toolProfile ? { toolProfile: runtime.toolProfile } : {}),
		toolsAllow: [...tools.map((candidate) => candidate.id), 'tool_search'],
		...(runtime.providerId ? { providerId: runtime.providerId } : {}),
		...(runtime.model ? { model: runtime.model } : {}),
		...(runtime.effort ? { effort: runtime.effort } : {}),
		...(runtime.promptCapabilities ? { promptCapabilities: runtime.promptCapabilities } : {}),
		...(runtime.scope ? { scope: runtime.scope } : {}),
	};
	const input: RuntimeInput =
		runtime.type === 'background'
			? { ...baseInput, type: 'background' }
			: { ...baseInput, type: 'default' };
	const session = createSessionState();
	session.id = runId;
	session.category = 'subagent';
	session.messages = [{ role: 'user', content: task }];

	let text = '';
	let result: SessionResult | undefined;
	let error: string | undefined;
	const { type: _type, ...streamOptions } = runtime;
	const events = stream(config, session, input, signal, {
		tools,
		instructions,
		progressiveDiscovery: true,
		...streamOptions,
	});
	try {
		for await (const event of events) {
			if (event.type === 'assistant_message') text = event.content;
			if (event.type === 'run_error') error = event.message;
			if (event.type === 'run_finished') result = event.result;
		}
	} catch (cause) {
		error = cause instanceof Error ? cause.message : String(cause);
	}
	text = (result?.text || text).slice(0, CHILD_SUMMARY_MAX_CHARS);
	const outcome = result
		? {
				sessionId: result.sessionId,
				model: result.model,
				subtype: result.subtype,
				toolCalls: result.toolCalls.length,
				toolNames: [...new Set(result.toolCalls.map((call) => call.name))],
			}
		: undefined;
	if (result?.subtype === 'error_max_turns') {
		return {
			status: 'failed',
			text: text || 'Subagent stopped: reached max iterations without a final answer.',
			stopReason: result.stopReason,
			usage: result.usage,
			result: outcome,
		};
	}
	if (signal.aborted || result?.stopReason === 'cancelled' || result?.stopReason === 'timeout') {
		return {
			status: 'cancelled',
			text,
			stopReason: result?.stopReason,
			usage: result?.usage,
			result: outcome,
		};
	}
	if (error)
		return {
			status: 'failed',
			text,
			stopReason: result?.stopReason,
			usage: result?.usage,
			error,
			result: outcome,
		};
	if (result?.stopReason === 'budget_exhausted') {
		return {
			status: 'exhausted',
			text,
			stopReason: result.stopReason,
			usage: result.usage,
			result: outcome,
		};
	}
	return {
		status: 'completed',
		text,
		stopReason: result?.stopReason,
		usage: result?.usage,
		result: outcome,
	};
}

const subagentInstructions = `You are a subagent spawned by the main agent to complete one specific task.

Rules:
- Stay focused: do the assigned task, nothing else. No side quests, no proactive actions.
- You are NOT the main agent: no user conversation, and no external messages unless the task explicitly asks for them.
- Some tools may be denied because they require user permission; work around them or report the limitation.

When you finish, your final response is reported back to the main agent. Include what you accomplished or found and any details the main agent needs. Keep it concise but informative.`;

const parallelInstructions = `${subagentInstructions}

You run in parallel with sibling subagents, so your tools are read-only. Do not attempt file changes, commands, schedules, persistence, or external actions.`;

const fallbackPool = new KeyedLimiter(3);
const PARENT_ONLY_TOOL_IDS = new Set(['subagent', 'ask', 'load_skill', 'undo', 'redo']);

export function subagentTool(config: Config, tools: () => Tool[], runtime: ChildRuntime): Tool {
	return tool({
		id: 'subagent',
		category: 'delegation',
		name: 'Subagent',
		description:
			'Spawn one to three subagents, each completing a task in its own isolated context and returning a summary. A single subagent has your tools except spawning subagents; two or three run concurrently with read-only tools. They do not receive the parent conversation or prior tool results, so give each a clear objective, all required context, and the expected output. Use them only for independent work that takes many steps or produces large intermediate output, never to resolve a follow-up reference. Tools that need user approval are unavailable to subagents. Results preserve input order, and one failed child does not cancel its siblings.',
		readOnly: true,
		inputSchema: z.object({
			tasks: z
				.array(
					z.object({
						id: z.string().trim().min(1).describe('Stable, unique task id'),
						task: z.string().trim().min(1).describe('The task for the subagent to complete'),
					})
				)
				.superRefine((tasks, context) => {
					const ids = new Set<string>();
					for (const task of tasks) {
						if (ids.has(task.id))
							context.addIssue({ code: 'custom', message: 'Subagent task ids must be unique.' });
						ids.add(task.id);
					}
				})
				.min(1)
				.max(3),
		}),
		execute: async ({ tasks }, signal) => {
			const parentSignal = signal ?? new AbortController().signal;
			const parallel = tasks.length > 1;
			const childTools = tools().filter(
				(candidate) =>
					!PARENT_ONLY_TOOL_IDS.has(candidate.id) && (!parallel || candidate.readOnly === true)
			);
			const pool = runtime.subagentLimiter ?? fallbackPool;
			const settled = await Promise.allSettled(
				tasks.map(async ({ task }) => {
					const lease = await pool.acquire('subagents', parentSignal);
					try {
						return await runChild(
							config,
							childTools,
							task,
							parallel ? parallelInstructions : subagentInstructions,
							parentSignal,
							runtime
						);
					} finally {
						lease.release();
					}
				})
			);
			const results = settled.map((result, index) =>
				result.status === 'fulfilled'
					? { id: tasks[index].id, ...result.value }
					: {
							id: tasks[index].id,
							status: 'failed' as const,
							text: '',
							error: result.reason instanceof Error ? result.reason.message : String(result.reason),
						}
			);
			return parallel ? results : results[0];
		},
	});
}
