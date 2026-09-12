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

function delegationOutcome(tool: AgentToolPart): { status?: string; count: number; completed: number } {
	let output = tool.output;
	if (typeof output === 'string') {
		try {
			output = JSON.parse(output);
		} catch {
			return { count: 0, completed: 0 };
		}
	}
	if (Array.isArray(output)) {
		const completed = output.filter(
			(item) => isRecord(item) && item.status === 'completed'
		).length;
		return { count: output.length, completed };
	}
	return isRecord(output) && typeof output.status === 'string'
		? { status: output.status, count: 1, completed: output.status === 'completed' ? 1 : 0 }
		: { count: 0, completed: 0 };
}

export function toolPartLabel(tool: AgentToolPart): string {
	if (tool.displayName) return tool.displayName;

	const mcp = mcpParts(tool.type);
	if (mcp) return `${mcp.server} · ${mcp.tool}`;

	const input = isRecord(tool.input) ? tool.input : {};
	const type = tool.type.toLowerCase();

	const task = TASK_TOOL_LABELS[type];
	if (task) return isToolRunning(tool) ? task.running : task.done;

	if (type === 'subagent' || type === 'subagents') {
		if (isToolRunning(tool)) {
			const tasks = isRecord(tool.input) && Array.isArray(tool.input.tasks) ? tool.input.tasks.length : 0;
			return tasks > 0 ? `Delegating ${tasks} tasks…` : 'Delegating task to a subagent…';
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

type GroupVerbs = { readonly running: string; readonly done: string; readonly noun: string };

function groupVerbs(type: string): GroupVerbs {
	const t = type.toLowerCase();
	if (t === 'read') return { running: 'Reading', done: 'Read', noun: 'file' };
	if (t === 'edit' || t === 'patch')
		return { running: 'Editing', done: 'Edited', noun: 'file' };
	if (t === 'write') return { running: 'Writing', done: 'Wrote', noun: 'file' };
	if (t === 'bash' || t === 'process')
		return { running: 'Running', done: 'Ran', noun: 'command' };
	if (t === 'grep' || t === 'search') return { running: 'Searching', done: 'Searched', noun: 'pattern' };
	if (t === 'list_dir') return { running: 'Listing', done: 'Listed', noun: 'folder' };
	if (t === 'load_skill') return { running: 'Loading', done: 'Loaded', noun: 'skill' };
	if (t === 'subagent' || t === 'subagents')
		return { running: 'Delegating', done: 'Delegated', noun: 'task' };
	if (t === 'use_web_browser' || t === 'fetch_web_page' || t === 'search_web') {
		return { running: 'Browsing', done: 'Browsed', noun: 'page' };
	}
	if (t.startsWith('mcp__')) return { running: 'Calling', done: 'Called', noun: 'tool' };
	return { running: 'Running', done: 'Ran', noun: 'tool' };
}

function toolRunningDetail(tool: AgentToolPart): string | undefined {
	const input = isRecord(tool.input) ? tool.input : {};
	const t = tool.type.toLowerCase();
	if (
		t === 'read' ||
		t === 'edit' ||
		t === 'write' ||
		t === 'patch' ||
		t === 'list_dir'
	) {
		const path = stringArg(input, 'path', 'file_path', 'filepath');
		return path ? basename(path) : undefined;
	}
	if (t === 'bash' || t === 'process')
		return stringArg(input, 'command', 'name');
	if (t === 'grep' || t === 'search') return stringArg(input, 'pattern', 'query');
	if (t === 'load_skill') return stringArg(input, 'name');
	if (t === 'use_web_browser' || t === 'fetch_web_page' || t === 'search_web') {
		return stringArg(input, 'url', 'query');
	}
	return undefined;
}

export function toolGroupLabel(type: string, tools: readonly AgentToolPart[]): string {
	const running = tools.filter(isToolRunning);
	if (type.toLowerCase() === 'task') return 'Tasks';
	if (type.toLowerCase() === 'app') return 'Apps';

	const verbs = groupVerbs(type);
	if (running.length > 0) {
		const detail = toolRunningDetail(running[running.length - 1]);
		return detail ? `${verbs.running} ${detail}` : `${verbs.running}…`;
	}
	return `${verbs.done} ${tools.length} ${verbs.noun}${tools.length === 1 ? '' : 's'}`;
}
