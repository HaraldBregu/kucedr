import { z } from 'zod';
import type { Tool } from '../types';
import { tool } from '../tools/tool';
import { searchTokens } from './tokens';

export const DISCOVER_TOOLS_ID = 'discover_tools';
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

export interface ToolDiscoveryResult {
	selectedToolIds: string[];
	selectedTools: Array<{ id: string; name: string; serviceId?: string; serviceName?: string }>;
	selectedServiceIds: string[];
	rejectedToolIds: string[];
	rejectedServerIds: string[];
	availableTools?: Array<{ id: string; name: string; description: string }>;
	limitReached: boolean;
}

interface ToolDiscoveryOptions {
	eligible: Tool[];
	required: Tool[];
	mcpTools?: DiscoveredMcpTool[];
	deferredMcpServers?: DeferredMcpServer[];
	loadMcpServers?: (serverIds: string[], signal?: AbortSignal) => Promise<DiscoveredMcpTool[]>;
	filterEligible?: (tools: Tool[]) => Tool[];
}

export interface ToolDiscovery {
	readonly tool: Tool;
	prompt(): string;
	active(): Tool[];
	eligible(): Tool[];
	replaceEligible(tools: Tool[]): void;
	activateImmediate(toolIds: readonly string[]): void;
}

export function createToolDiscovery(options: ToolDiscoveryOptions): ToolDiscovery {
	let eligible = new Map(options.eligible.map((candidate) => [candidate.id, candidate]));
	const required = new Map(options.required.map((candidate) => [candidate.id, candidate]));
	const active = new Map(required);
	const mcpMetadata = new Map(
		(options.mcpTools ?? []).map((entry) => [
			entry.tool.id,
			{ serverId: entry.serverId, serverName: entry.serverName },
		])
	);
	const deferredServers = new Map(
		(options.deferredMcpServers ?? []).map((server) => [server.id, server])
	);
	let selectedCount = 0;

	const directory = (): string => {
		const tools = [...new Map([...eligible, ...active]).values()]
			.sort((left, right) => left.id.localeCompare(right.id))
			.map(
				(candidate) =>
					`${candidate.id} | ${candidate.name} | ${active.has(candidate.id) ? 'Loaded' : 'Not loaded; use discover_tools'} | ${candidate.description.replace(/\s+/g, ' ').trim()}`
			);
		const servers = [...deferredServers.values()]
			.sort((left, right) => left.id.localeCompare(right.id))
			.map((server) => `${server.id} | ${server.name}`);
		return [
			'## Tool loading and availability',
			'Answer directly when no tool is needed. Before any tool call, check its current loading status below. Only Loaded tools with schemas in this response are callable.',
			'For a tool marked Not loaded, first call discover_tools with a concise query and its exact toolIds. Wait for the result and the next model turn before calling the selected tool using its newly exposed schema. Never call a tool to test whether it is loaded, and never batch discovery with calls to tools that are not yet loaded.',
			...(eligible.has('write') && !active.has('write')
				? ['For example, to create a demo file when write is not loaded: call discover_tools({"query":"Create a demo file","toolIds":["write"],"mcpServerIds":[]}); then, on the next turn, call write using its exposed schema.']
				: []),
			'If a call reports an unknown or unavailable tool, check this directory and use discover_tools before retrying. Tools absent from the directory are unavailable; do not invent IDs. Loading resets for each run, so past conversation calls do not establish current availability.',
			'For an unloaded MCP server, use discover_tools with its mcpServerIds and a capability query. Only that server is queried. If no tools are selected, choose exact toolIds from the returned list in another discovery call.',
			'At most 8 new tools can be selected per discovery call and 16 per run. Several already-loaded tools may be called together and will execute sequentially.',
			'ID | Name | Status | Description',
			...tools,
			...(servers.length > 0 ? ['Deferred MCP servers (server ID | name):', ...servers] : []),
		].join('\n');
	};

	const discoveryTool = tool({
		id: DISCOVER_TOOLS_ID,
		name: 'Discover tools',
		description: 'Search for and load tools needed for the next step. Call this before using any tool marked Not loaded in the tool directory. Selected tool schemas become callable on the next model turn; wait for this result before using them.',
		planSafe: true,
		capability: { effects: ['read'] },
		inputSchema: z.object({
			query: z.string().trim().min(1).max(240).describe('Concise capability need.'),
			toolIds: z.array(z.string().trim().min(1)).max(64).default([]),
			mcpServerIds: z.array(z.string().trim().min(1)).max(64).default([]),
		}),
		execute: async ({ query, toolIds, mcpServerIds }, signal): Promise<ToolDiscoveryResult> => {
			signal?.throwIfAborted();
			const requestedServers = [...new Set(mcpServerIds)];
			const allowedServers = requestedServers.filter((id) => deferredServers.has(id));
			const rejectedServerIds = requestedServers.filter((id) => !deferredServers.has(id));
			let loaded: DiscoveredMcpTool[] = [];
			if (allowedServers.length > 0 && options.loadMcpServers) {
				loaded = await options.loadMcpServers(allowedServers, signal);
				signal?.throwIfAborted();
				for (const id of allowedServers) deferredServers.delete(id);
				const filtered = options.filterEligible
					? options.filterEligible(loaded.map((entry) => entry.tool))
					: loaded.map((entry) => entry.tool);
				const allowedIds = new Set(filtered.map((candidate) => candidate.id));
				for (const entry of loaded) {
					if (!allowedIds.has(entry.tool.id)) continue;
					eligible.set(entry.tool.id, entry.tool);
					mcpMetadata.set(entry.tool.id, {
						serverId: entry.serverId,
						serverName: entry.serverName,
					});
				}
			}

			const rejectedToolIds = toolIds.filter((id) => !eligible.has(id));
			const requested = [...new Set(toolIds)].filter((id) => eligible.has(id));
			if (requested.length === 0) {
				const queryTokens = searchTokens(query);
				const loadedIds = new Set(loaded.map((entry) => entry.tool.id));
				const pool =
					loaded.length > 0
						? [...eligible.values()].filter((candidate) => loadedIds.has(candidate.id))
						: [...eligible.values()];
				const scored = pool
					.map((candidate) => {
						const text =
							`${candidate.id} ${candidate.name} ${candidate.description}`.toLocaleLowerCase();
						return {
							id: candidate.id,
							score: queryTokens.reduce(
								(score, token) => score + (text.includes(token) ? 1 : 0),
								0
							),
						};
					})
					.filter((candidate) => candidate.score > 0)
					.sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
				const bestScore = scored[0]?.score ?? 0;
				requested.push(
					...scored
						.filter((candidate) => candidate.score === bestScore)
						.map((candidate) => candidate.id)
				);
			}

			const remaining = Math.max(0, DISCOVERY_RUN_LIMIT - selectedCount);
			const newToolIds = requested.filter((id) => !active.has(id));
			const selectedToolIds = newToolIds.slice(0, Math.min(DISCOVERY_CALL_LIMIT, remaining));
			for (const id of selectedToolIds) active.set(id, eligible.get(id)!);
			selectedCount += selectedToolIds.length;
			const selectedTools = selectedToolIds.map((id) => {
				const candidate = eligible.get(id)!;
				const service = mcpMetadata.get(id);
				return {
					id,
					name: candidate.name,
					...(service ? { serviceId: service.serverId, serviceName: service.serverName } : {}),
				};
			});
			const selectedServiceIds = [
				...new Set(selectedTools.flatMap((entry) => entry.serviceId ?? [])),
			];
			const noMatch = selectedToolIds.length === 0 && loaded.length > 0;
			return {
				selectedToolIds,
				selectedTools,
				selectedServiceIds,
				rejectedToolIds,
				rejectedServerIds,
				...(noMatch
					? {
							availableTools: loaded
								.filter((entry) => eligible.has(entry.tool.id))
								.map((entry) => ({
									id: entry.tool.id,
									name: entry.tool.name,
									description: entry.tool.description,
								})),
						}
					: {}),
				limitReached:
					newToolIds.length > selectedToolIds.length || selectedCount >= DISCOVERY_RUN_LIMIT,
			};
		},
	});
	active.set(discoveryTool.id, discoveryTool);

	return {
		tool: discoveryTool,
		prompt: directory,
		active: () => [...active.values()],
		eligible: () => [...eligible.values()],
		replaceEligible(tools) {
			eligible = new Map(tools.map((candidate) => [candidate.id, candidate]));
			for (const id of active.keys()) {
				if (id !== DISCOVER_TOOLS_ID && !required.has(id) && !eligible.has(id)) active.delete(id);
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
