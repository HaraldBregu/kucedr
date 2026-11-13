import { googleService } from '@/components/prompt-kit/google';
import { TASK_TOOL_LABELS } from '@/components/prompt-kit/task';
import type { AgentToolPart } from '../context';

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function basename(path: string): string {
	const normalized = path.replace(/\\/g, '/');
	const parts = normalized.split('/');
	return parts[parts.length - 1] || path;
}

function stringArg(input: Record<string, unknown>, ...keys: string[]): string | undefined {
	for (const key of keys) {
		const value = input[key];
		if (typeof value === 'string' && value.length > 0) return value;
	}
	return undefined;
}

function capitalizeType(type: string): string {
	const normalized = type.replace(/_/g, ' ');
	return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function mcpParts(type: string): { server: string; tool: string } | undefined {
	if (!type.toLowerCase().startsWith('mcp__')) return undefined;
	const segments = type.split('__');
	if (segments.length < 3) return undefined;
	return { server: segments[1], tool: segments.slice(2).join('__') };
}

function delegationOutcome(tool: AgentToolPart): {
	status?: string;
	count: number;
	completed: number;
} {
	let output = tool.output;
	if (typeof output === 'string') {
		try {
			output = JSON.parse(output);
		} catch {
			return { count: 0, completed: 0 };
		}
	}
	if (Array.isArray(output)) {
		const completed = output.filter((item) => isRecord(item) && item.status === 'completed').length;
		return { count: output.length, completed };
	}
	return isRecord(output) && typeof output.status === 'string'
		? { status: output.status, count: 1, completed: output.status === 'completed' ? 1 : 0 }
		: { count: 0, completed: 0 };
}

export function toolPartLabel(tool: AgentToolPart): string {
	if (tool.displayName) return tool.displayName;

	const mcp = mcpParts(tool.type);
	const google = googleService(tool);
	if (mcp && google) return `${google.name} · ${mcp.tool}`;
	if (mcp) return `${mcp.server.charAt(0).toUpperCase()}${mcp.server.slice(1)} · ${mcp.tool}`;

	const input = isRecord(tool.input) ? tool.input : {};
	const type = tool.type.toLowerCase();

	const task = TASK_TOOL_LABELS[type];
	if (task) return isToolRunning(tool) ? task.running : task.done;
	if (type === 'get_health') return isToolRunning(tool) ? 'Loading health' : 'Health loaded';
	if (type === 'update_health') return isToolRunning(tool) ? 'Updating health' : 'Health updated';

	if (type === 'subagent' || type === 'subagents') {
		if (isToolRunning(tool)) {
			const tasks =
				isRecord(tool.input) && Array.isArray(tool.input.tasks) ? tool.input.tasks.length : 0;
			return tasks > 1 ? `Delegating ${tasks} tasks…` : 'Delegating task to a subagent…';
		}
		const outcome = delegationOutcome(tool);
		if (outcome.count > 1) {
			return outcome.completed === outcome.count
				? `${outcome.count} subagents completed`
				: `${outcome.completed}/${outcome.count} subagents completed`;
		}
		if (outcome.status === 'cancelled') return 'Subagent cancelled';
		if (outcome.status === 'failed') return 'Subagent failed';
		if (outcome.status === 'exhausted') return 'Subagent budget exhausted';
		return 'Subagent completed';
	}

	if (type === 'read') {
		const path = stringArg(input, 'path', 'file_path', 'filepath');
		if (path) return `Read ${basename(path)}`;
	}

	if (type === 'grep' || type === 'search') {
		const pattern = stringArg(input, 'pattern', 'query');
		if (pattern) return `Searched codebase for "${pattern}"`;
		return 'Searched codebase';
	}

	if (type === 'load_skill') {
		const name = stringArg(input, 'name');
		return name ? `Using skill '${name}'` : 'Using skill';
	}

	if (type === 'list_dir') {
		const path = stringArg(input, 'path');
		if (path) return `Listed ${basename(path)}`;
	}

	return capitalizeType(tool.type);
}

export function isToolRunning(tool: AgentToolPart): boolean {
	return tool.state === 'input-streaming' || tool.state === 'input-available';
}

export function toolActivityLabel(tool: AgentToolPart): string {
	const t = tool.type.toLowerCase();
	if (t === 'read') return 'Reading file…';
	if (t === 'edit' || t === 'patch' || t === 'write') return 'Writing file…';
	if (t === 'bash' || t === 'process') return 'Running command…';
	if (t === 'grep' || t === 'search') return 'Searching files…';
	if (t === 'list_dir') return 'Browsing folder…';
	if (t === 'load_skill' || t.includes('skill')) return 'Loading skill…';
	if (t === 'subagent' || t === 'subagents') return 'Delegating task…';
	if (t === 'search_web') return 'Searching on web…';
	if (t === 'use_web_browser' || t === 'fetch_web_page') return 'Browsing web…';
	return 'Working…';
}
