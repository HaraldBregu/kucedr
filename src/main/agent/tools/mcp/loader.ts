import { close, connect, getMcpServers, listTools, type McpClient } from '../../../mcp';
import type { JSONSchema, McpDiscoveryDiagnostics, Tool } from '../../types';
import { MCP_MAX_TOOLS } from './limits';
import { mcpToolName } from './name';
import { mcpTool } from './tool';
import { closeMcpClients } from './close';
import type { DeferredMcpServer, DiscoveredMcpTool } from '../../runner/run_discovery';

type DiscoveredServer =
	| { id: string; failure: 'connect' }
	| { id: string; client: McpClient; failure: 'list' }
	| {
			id: string;
			client: McpClient;
			approval: 'always' | 'never' | undefined;
			listed: Awaited<ReturnType<typeof listTools>>;
	  };

export async function loadMcpTools(signal?: AbortSignal): Promise<{
	tools: Tool[];
	entries: DiscoveredMcpTool[];
	deferredServers: DeferredMcpServer[];
	loadDeferred: (serverIds: string[], signal?: AbortSignal) => Promise<DiscoveredMcpTool[]>;
	diagnostics: McpDiscoveryDiagnostics;
	close: () => Promise<void>;
}> {
	const tools: Tool[] = [];
	const entries: DiscoveredMcpTool[] = [];
	const clients = new Set<McpClient>();
	const usedNames = new Set<string>();
	const servers = Object.entries(getMcpServers()).sort(([left], [right]) =>
		left.localeCompare(right)
	);
	const diagnostics: McpDiscoveryDiagnostics = {
		configuredServers: servers.length,
		enabledServers: servers.filter(([, data]) => data.enabled !== false).length,
		connectedServers: 0,
		listedTools: 0,
		loadedTools: 0,
		rejectedTools: 0,
		truncated: false,
		failures: [],
	};
	const enabledServers = servers.filter(([, data]) => data.enabled !== false);
	const eagerServers = enabledServers.filter(([, data]) => data.defer_loading !== true);
	const deferredServers = enabledServers
		.filter(([, data]) => data.defer_loading === true)
		.map(([id, data]) => ({ id, name: data.name?.trim() || id }));
	const serverData = new Map(enabledServers);
	const loadedServerIds = new Set<string>();
	const failedServerIds = new Set<string>();
	try {
		const discover = async (
			selected: Array<(typeof enabledServers)[number]>,
			discoverySignal?: AbortSignal
		): Promise<DiscoveredMcpTool[]> => {
			const discovered = await Promise.allSettled(
				selected.map(async ([id, data]): Promise<DiscoveredServer> => {
					discoverySignal?.throwIfAborted();
					let client: McpClient;
					try {
						client = await connect(id, data, 30_000, discoverySignal);
					} catch (error) {
						if (discoverySignal?.aborted) throw error;
						return { id, failure: 'connect' };
					}
					clients.add(client);
					try {
						return {
							id,
							client,
							approval: data.require_approval,
							listed: await listTools(client, 30_000, discoverySignal),
						};
					} catch (error) {
						if (discoverySignal?.aborted) throw error;
						clients.delete(client);
						await close(client).catch(() => undefined);
						return { id, client, failure: 'list' };
					}
				})
			);
			const rejected = discovered.find(
				(result): result is PromiseRejectedResult => result.status === 'rejected'
			);
			if (rejected) {
				await closeMcpClients(clients);
				throw rejected.reason;
			}

			const newlyDiscovered: DiscoveredMcpTool[] = [];
			for (const settled of discovered) {
				if (settled.status !== 'fulfilled') continue;
				const result = settled.value;
				if ('failure' in result) {
					failedServerIds.add(result.id);
					if (result.failure === 'connect') {
						diagnostics.failures.push({ serverId: result.id, phase: 'connect' });
						continue;
					}
					diagnostics.connectedServers += 1;
					diagnostics.failures.push({ serverId: result.id, phase: 'list' });
					continue;
				}
				loadedServerIds.add(result.id);
				diagnostics.connectedServers += 1;
				diagnostics.listedTools += result.listed.tools.length;
				if (tools.length >= MCP_MAX_TOOLS) {
					diagnostics.truncated = true;
					diagnostics.rejectedTools += result.listed.tools.length;
					diagnostics.failures.push({ serverId: result.id, phase: 'limit' });
					continue;
				}
				for (const [index, listedTool] of result.listed.tools.entries()) {
					if (tools.length >= MCP_MAX_TOOLS) {
						diagnostics.truncated = true;
						diagnostics.rejectedTools += result.listed.tools.length - index;
						diagnostics.failures.push({ serverId: result.id, phase: 'limit' });
						break;
					}
					try {
						const runtimeName = mcpToolName(result.id, listedTool.name, usedNames);
						const configured = mcpTool(
							result.client,
							listedTool.name,
							listedTool.description ?? '',
							listedTool.inputSchema as JSONSchema,
							result.id,
							result.approval,
							runtimeName,
							listedTool.annotations?.readOnlyHint === true
						);
						tools.push(configured);
						const entry = {
							tool: configured,
							serverId: result.id,
							serverName: serverData.get(result.id)?.name?.trim() || result.id,
						};
						entries.push(entry);
						newlyDiscovered.push(entry);
						usedNames.add(runtimeName);
						diagnostics.loadedTools += 1;
					} catch {
						diagnostics.rejectedTools += 1;
						diagnostics.failures.push({
							serverId: result.id,
							phase: 'schema',
							toolName: listedTool.name,
						});
					}
				}
			}
			return newlyDiscovered;
		};

		await discover(eagerServers, signal);
		return {
			tools,
			entries,
			deferredServers,
			loadDeferred: async (serverIds, discoverySignal = signal) => {
				const selected = [...new Set(serverIds)].flatMap((id) => {
					if (loadedServerIds.has(id) || failedServerIds.has(id)) return [];
					const data = serverData.get(id);
					return data?.defer_loading === true
						? [[id, data] as (typeof enabledServers)[number]]
						: [];
				});
				return selected.length > 0 ? discover(selected, discoverySignal) : [];
			},
			diagnostics,
			close: () => closeMcpClients(clients),
		};
	} catch (error) {
		await closeMcpClients(clients);
		throw error;
	}
}
