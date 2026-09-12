import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { KeyedLimiter } from '../../limiter';
import { stream, type StreamOptions } from '../../runner/run_stream';
import { createSessionState } from '../../session';
import type { Config, RuntimeInput, SessionResult, Tool } from '../../types';
import type { AgentRunType } from '../../../../shared/agent_types';
import { tool } from '../tool';

export interface ChildRuntime extends Pick<
	StreamOptions,
	'resources' | 'providerLimiter' | 'subagentLimiter' | 'budget' | 'modelOptions'
> {
	type: AgentRunType;
	interactionMode: import('../../../../shared/agent_types').AgentInteractionMode;
	providerId?: string;
	model?: string;
	effort?: RuntimeInput['effort'];
	promptCapabilities?: RuntimeInput['promptCapabilities'];
	scope?: RuntimeInput['scope'];
}

export interface ChildOutcome {
	status: 'completed' | 'cancelled' | 'failed' | 'exhausted';
	text: string;
	stopReason?: string;
	usage?: SessionResult['usage'];
	error?: string;
	result?: Pick<SessionResult, 'sessionId' | 'model' | 'subtype' | 'toolCalls'>;
}

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
		interactionMode: runtime.interactionMode,
		toolsAllow: tools.map((candidate) => candidate.id),
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
	text = result?.text || text;
	const outcome = result
		? {
				sessionId: result.sessionId,
				model: result.model,
				subtype: result.subtype,
				toolCalls: result.toolCalls,
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

const subagentsInstructions = `You are one of several parallel subagents spawned by the main agent to complete one independent research or inspection task.

Rules:
- Stay focused on the assigned task and return only the findings the main agent needs.
- Treat the available tools as read-only. Do not attempt file changes, commands, schedules, persistence, or external actions.
- You are NOT the main agent: do not converse with the user or spawn more agents.`;

const fallbackPool = new KeyedLimiter(3);
const PARALLEL_TOOL_IDS = new Set(['read', 'search_web', 'fetch_web_page', 'query_knowledge']);

export function subagentTool(config: Config, tools: Tool[], runtime: ChildRuntime): Tool {
	return tool({
		id: 'subagent',
		name: 'Subagent',
		description:
			'Spawn a subagent to complete a task in its own isolated context and return a summary. It has the same tools as you, except spawning subagents. Use it for work that takes many steps, produces large intermediate output, or is independent of the conversation. Give it a clear objective and the expected output.',
		planSafe: true,
		inputSchema: z.object({
			task: z.string().describe('The task for the subagent to complete'),
		}),
		execute: async ({ task }, signal) => {
			const childTools = tools.filter(
				(candidate) =>
					candidate.id !== 'subagent' &&
					candidate.id !== 'subagents' &&
					candidate.id !== 'ask' &&
					candidate.id !== 'load_skill'
			);
			const parentSignal = signal ?? new AbortController().signal;
			const lease = await (runtime.subagentLimiter ?? fallbackPool).acquire(
				'subagents',
				parentSignal
			);
			try {
				return await runChild(
					config,
					childTools,
					task,
					subagentInstructions,
					parentSignal,
					runtime
				);
			} finally {
				lease.release();
			}
		},
	});
}

export function subagentsTool(
	config: Config,
	tools: Tool[],
	runtime: ChildRuntime,
	pool: KeyedLimiter = fallbackPool
): Tool {
	return tool({
		id: 'subagents',
		name: 'Subagents',
		description:
			'Spawn two or three independent read-only subagents concurrently. Each task must have a stable id. Results preserve input order, and one failed child does not cancel its siblings.',
		planSafe: true,
		inputSchema: z.object({
			tasks: z
				.array(
					z.object({
						id: z.string().trim().min(1),
						task: z.string().trim().min(1),
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
				.min(2)
				.max(3),
		}),
		execute: async ({ tasks }, signal) => {
			const parentSignal = signal ?? new AbortController().signal;
			const childTools = tools.filter((candidate) => PARALLEL_TOOL_IDS.has(candidate.id));
			const settled = await Promise.allSettled(
				tasks.map(async ({ task }) => {
					const lease = await pool.acquire('subagents', parentSignal);
					try {
						return await runChild(
							config,
							childTools,
							task,
							subagentsInstructions,
							parentSignal,
							runtime
						);
					} finally {
						lease.release();
					}
				})
			);
			return settled.map((result, index) =>
				result.status === 'fulfilled'
					? { id: tasks[index].id, ...result.value }
					: {
							id: tasks[index].id,
							status: 'failed' as const,
							text: '',
							error: result.reason instanceof Error ? result.reason.message : String(result.reason),
						}
			);
		},
	});
}
