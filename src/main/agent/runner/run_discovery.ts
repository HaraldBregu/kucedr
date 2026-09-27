import { z } from 'zod';
import type { Tool } from '../types';
import { tool } from '../tools/tool';
import { rankTools, toolSearchText } from './rank';

export const TOOL_SEARCH_ID = 'tool_search';
export const TOOL_SEARCH_DEFAULT_LIMIT = 5;
export const TOOL_SEARCH_CALL_LIMIT = 8;
export const TOOL_SEARCH_RUN_LIMIT = 16;

export interface DiscoveredMcpTool {
	tool: Tool;
	serverId: string;
	serverName: string;
}

interface ToolSearchOptions {
	eligible: Tool[];
	required: Tool[];
	discoveryEnabled?: boolean;
	mcpTools?: DiscoveredMcpTool[];
	filterEligible?: (tools: Tool[]) => Tool[];
}

export interface ToolSearch {
	readonly tool: Tool;
	active(): Tool[];
	replaceEligible(tools: Tool[]): void;
	activateImmediate(toolIds: readonly string[]): void;
}

export function createToolSearch(options: ToolSearchOptions): ToolSearch {
	const allowed = (tools: Tool[]) => options.filterEligible?.(tools) ?? tools;
	let eligible = new Map(allowed(options.eligible).map((candidate) => [candidate.id, candidate]));
	const required = allowed(options.required).filter((candidate) => eligible.has(candidate.id));
	const active = new Map(required.map((candidate) => [candidate.id, candidate]));
	const mcpMetadata = new Map((options.mcpTools ?? []).map((entry) => [entry.tool.id, entry]));
	let selectedCount = 0;

	const searchTool = tool({
		id: TOOL_SEARCH_ID,
		name: 'Search tools',
		description:
			'Search for a capability only when the tools already available cannot handle the task. Matching is deterministic; selected tools become available on the next turn.',
		planSafe: true,
		capability: { effects: ['read'] },
		inputSchema: z.object({
			query: z.string().trim().min(1).max(240).describe('The capability needed for the next step.'),
			limit: z.number().int().min(1).max(TOOL_SEARCH_CALL_LIMIT).default(TOOL_SEARCH_DEFAULT_LIMIT),
		}),
		execute: ({ query, limit }, signal) => {
			const startedAt = Date.now();
			signal?.throwIfAborted();
			const remaining = Math.max(0, TOOL_SEARCH_RUN_LIMIT - selectedCount);
			const selected = rankTools(
				query,
				[...eligible.values()]
					.filter((candidate) => !active.has(candidate.id))
					.map((candidate) => {
						const mcp = mcpMetadata.get(candidate.id);
						return {
							value: candidate,
							text: `${toolSearchText(candidate)} ${mcp?.serverId ?? ''} ${mcp?.serverName ?? ''} ${mcp?.tool.policy?.kind === 'mcp' ? mcp.tool.policy.toolName : ''}`,
						};
					})
			).slice(0, Math.min(limit, remaining));
			for (const candidate of selected) active.set(candidate.id, candidate);
			selectedCount += selected.length;
			return {
				selectedToolIds: selected.map((candidate) => candidate.id),
				selectedCanonicalIds: selected.map((candidate) => {
					const mcp = mcpMetadata.get(candidate.id);
					return mcp && mcp.tool.policy?.kind === 'mcp'
						? `${mcp.serverId}.${mcp.tool.policy.toolName}`
						: `${['read', 'write', 'edit', 'patch', 'undo', 'redo'].includes(candidate.id) ? 'files' : 'native'}.${candidate.id}`;
				}),
				selectedServiceIds: [
					...new Set(selected.flatMap((candidate) => mcpMetadata.get(candidate.id)?.serverId ?? [])),
				],
				selectedCount: selected.length,
				latencyMs: Date.now() - startedAt,
				limitReached: selectedCount >= TOOL_SEARCH_RUN_LIMIT,
			};
		},
	});
	if (options.discoveryEnabled !== false) active.set(searchTool.id, searchTool);

	return {
		tool: searchTool,
		active: () => [...active.values()],
		replaceEligible(tools) {
			eligible = new Map(allowed(tools).map((candidate) => [candidate.id, candidate]));
			for (const id of active.keys()) {
				if (id !== TOOL_SEARCH_ID && !eligible.has(id)) active.delete(id);
			}
		},
		activateImmediate(toolIds) {
			for (const id of toolIds) {
				const candidate = eligible.get(id);
				if (candidate) active.set(id, candidate);
			}
		},
	};
}
