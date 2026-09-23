import { z } from 'zod';
import type { Tool } from '../types';
import { tool } from '../tools/tool';
import { isStrongMatch, rankTools, toolSearchText } from './rank';

export const DISCOVER_TOOLS_ID = 'discover_tools';
export const DISCOVERY_DEFAULT_LIMIT = 5;
export const DISCOVERY_CALL_LIMIT = 8;
export const DISCOVERY_RUN_LIMIT = 16;

export interface DiscoveredMcpTool {
	tool: Tool;
	serverId: string;
	serverName: string;
}

export interface DeferredMcpServer {
	id: string;
	name: string;
}

interface ToolDiscoveryOptions {
	eligible: Tool[];
	required: Tool[];
	discoveryEnabled?: boolean;
	mcpTools?: DiscoveredMcpTool[];
	deferredMcpServers?: DeferredMcpServer[];
	loadMcpServers?: (serverIds: string[], signal?: AbortSignal) => Promise<DiscoveredMcpTool[]>;
	filterEligible?: (tools: Tool[]) => Tool[];
}

export interface ToolDiscovery {
	readonly tool: Tool;
	active(): Tool[];
	replaceEligible(tools: Tool[]): void;
	activateImmediate(toolIds: readonly string[]): void;
	preselect(query: string, signal?: AbortSignal): Promise<{ tools: Tool[]; serviceIds: string[] }>;
	activateInactive(toolIds: readonly string[]): { tools: Tool[]; serviceIds: string[] };
}

export function createToolDiscovery(options: ToolDiscoveryOptions): ToolDiscovery {
	let eligible = new Map(options.eligible.map((candidate) => [candidate.id, candidate]));
	const required = new Map(options.required.map((candidate) => [candidate.id, candidate]));
	const active = new Map(required);
	const deferredServers = new Map(
		(options.deferredMcpServers ?? []).map((server) => [server.id, server])
	);
	const mcpMetadata = new Map(
		(options.mcpTools ?? []).map((entry) => [entry.tool.id, entry.serverId])
	);
	let selectedCount = 0;

	const loadMatchingServers = async (query: string, signal?: AbortSignal) => {
		const matchingServers = rankTools(
			query,
			[...deferredServers.values()]
				.filter((server) => isStrongMatch(query, server.id, server.name, `${server.id} ${server.name}`))
				.map((server) => ({ value: server, text: `${server.id} ${server.name}` }))
		).slice(0, DISCOVERY_DEFAULT_LIMIT);
		if (matchingServers.length === 0 || !options.loadMcpServers) return [];
		const loaded = await options.loadMcpServers(
			matchingServers.map((server) => server.id),
			signal
		);
		for (const server of matchingServers) deferredServers.delete(server.id);
		const filtered = options.filterEligible
			? options.filterEligible(loaded.map((entry) => entry.tool))
			: loaded.map((entry) => entry.tool);
		for (const candidate of filtered) eligible.set(candidate.id, candidate);
		for (const entry of loaded) mcpMetadata.set(entry.tool.id, entry.serverId);
		return matchingServers.map((server) => server.id);
	};

	const discoveryTool = tool({
		id: DISCOVER_TOOLS_ID,
		name: 'Discover tools',
		description:
			'Search for tools needed for the next step and activate the best matches. Use when the request requires a capability that is not currently available.',
		planSafe: true,
		capability: { effects: ['read'] },
		inputSchema: z.object({
			query: z
				.string()
				.trim()
				.min(1)
				.max(240)
				.describe('A concise description of the needed capability.'),
			limit: z.number().int().min(1).max(DISCOVERY_CALL_LIMIT).default(DISCOVERY_DEFAULT_LIMIT),
		}),
		execute: async ({ query, limit }, signal) => {
			const startedAt = Date.now();
			signal?.throwIfAborted();
			await loadMatchingServers(query, signal);

			const remaining = Math.max(0, DISCOVERY_RUN_LIMIT - selectedCount);
			const selected = rankTools(
				query,
				[...eligible.values()]
					.filter((candidate) => !active.has(candidate.id))
					.map((candidate) => ({ value: candidate, text: toolSearchText(candidate) }))
			).slice(0, Math.min(limit, DISCOVERY_CALL_LIMIT, remaining));
			for (const candidate of selected) active.set(candidate.id, candidate);
			selectedCount += selected.length;
			return {
				selectedToolIds: selected.map((candidate) => candidate.id),
				selectedServiceIds: [
					...new Set(selected.flatMap((candidate) => mcpMetadata.get(candidate.id) ?? [])),
				],
				selectedCount: selected.length,
				latencyMs: Date.now() - startedAt,
				limitReached: selectedCount >= DISCOVERY_RUN_LIMIT,
			};
		},
	});
	if (options.discoveryEnabled !== false) active.set(discoveryTool.id, discoveryTool);

	return {
		tool: discoveryTool,
		active: () => [...active.values()],
		replaceEligible(tools) {
			eligible = new Map(tools.map((candidate) => [candidate.id, candidate]));
			for (const id of active.keys()) {
				if (id !== DISCOVER_TOOLS_ID && !eligible.has(id)) active.delete(id);
			}
		},
		activateImmediate(toolIds) {
			for (const id of toolIds) {
				const candidate = eligible.get(id);
				if (candidate) active.set(id, candidate);
			}
		},
		async preselect(query, signal) {
			const serviceIds = await loadMatchingServers(query, signal);
			const remaining = Math.max(0, DISCOVERY_RUN_LIMIT - selectedCount);
			const selected = rankTools(
				query,
				[...eligible.values()]
					.filter(
						(candidate) =>
							!active.has(candidate.id) &&
							isStrongMatch(query, candidate.id, candidate.name, toolSearchText(candidate))
					)
					.map((candidate) => ({ value: candidate, text: toolSearchText(candidate) }))
			).slice(0, Math.min(DISCOVERY_DEFAULT_LIMIT, remaining));
			for (const candidate of selected) active.set(candidate.id, candidate);
			selectedCount += selected.length;
			return { tools: selected, serviceIds };
		},
		activateInactive(toolIds) {
			const activated: Tool[] = [];
			for (const id of new Set(toolIds)) {
				if (active.has(id)) continue;
				const candidate = eligible.get(id);
				if (!candidate) continue;
				active.set(id, candidate);
				activated.push(candidate);
			}
			return {
				tools: activated,
				serviceIds: [
					...new Set(activated.flatMap((candidate) => mcpMetadata.get(candidate.id) ?? [])),
				],
			};
		},
	};
}
