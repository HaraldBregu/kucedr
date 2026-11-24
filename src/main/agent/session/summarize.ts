import type { AgentRunInsights } from '../../../shared/agent_types';
import { metric } from './metric';

interface TraceEvent {
	type: string;
	model?: unknown;
	toolName?: unknown;
	toolCallId?: unknown;
	usage?: Partial<Record<'inputTokens' | 'outputTokens' | 'cachedTokens' | 'costUsd', unknown>>;
	numTurns?: unknown;
	durationMs?: unknown;
	firstTokenLatencyMs?: unknown;
}

export interface TimedRunEvent {
	time: number;
	event: TraceEvent;
}

export function summarizeRun(events: TimedRunEvent[], terminal: TraceEvent): AgentRunInsights {
	const origin = events[0].time;
	const result: AgentRunInsights = { steps: [] };
	const tools = new Map<string, AgentRunInsights['steps'][number]>();
	const calls: TraceEvent[] = [];
	let modelStep: AgentRunInsights['steps'][number] | undefined;

	for (const { time, event } of events) {
		const offsetMs = Math.max(0, time - origin);
		if (event.type === 'model_call_start' || event.type === 'model_call_end') {
			const hasStart = modelStep !== undefined;
			if (event.type === 'model_call_start' || !modelStep) {
				const model = event.model ?? events[0].event.model;
				modelStep = { kind: 'model', name: typeof model === 'string' ? model : '', offsetMs };
				result.steps.push(modelStep);
			}
			if (event.type === 'model_call_end') {
				calls.push(event);
				const duration = metric(event.durationMs);
				if (duration !== undefined) {
					modelStep.durationMs = duration;
					modelStep.offsetMs = Math.max(0, offsetMs - duration);
				}
				const latency = metric(event.firstTokenLatencyMs);
				if (calls.length === 1 && latency !== undefined && (hasStart || duration !== undefined))
					result.firstTokenMs = (modelStep.offsetMs ?? 0) + latency;
				modelStep = undefined;
			}
		} else if (event.type === 'tool_call_start' || event.type === 'tool_call_end') {
			const id = typeof event.toolCallId === 'string' ? event.toolCallId : undefined;
			let step = id ? tools.get(id) : undefined;
			const hasStart = step !== undefined;
			if (event.type === 'tool_call_start' || !step) {
				step = { kind: 'tool', name: typeof event.toolName === 'string' ? event.toolName : '', offsetMs };
				result.steps.push(step);
				if (id) tools.set(id, step);
			}
			if (event.type === 'tool_call_end') {
				const duration = metric(event.durationMs);
				if (duration !== undefined) {
					step.durationMs = duration;
					if (!hasStart) step.offsetMs = Math.max(0, offsetMs - duration);
				} else if (hasStart && step.offsetMs !== undefined) {
					step.durationMs = Math.max(0, offsetMs - step.offsetMs);
				}
				if (id) tools.delete(id);
			}
		}
	}

	result.turns = metric(terminal.numTurns) ?? (calls.length || undefined);
	for (const key of ['inputTokens', 'outputTokens', 'cachedTokens', 'costUsd'] as const) {
		const total = metric(terminal.usage?.[key]);
		if (total !== undefined) result[key] = total;
		else if (calls.length && calls.length === result.turns) {
			const values = calls.map((call) => metric(call.usage?.[key]));
			if (values.every((value) => value !== undefined)) result[key] = values.reduce((sum, value) => sum + value, 0);
		}
	}
	return result;
}
