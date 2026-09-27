import { ToolListChangedNotificationSchema } from '@modelcontextprotocol/sdk/types.js';
import { close, connect, getMcpServers, type McpClient } from '../../../mcp';
import type { JSONSchema, McpDiscoveryDiagnostics, Tool } from '../../types';
import type { DiscoveredMcpTool } from '../../runner/run_discovery';
import type { McpApprovalPolicy } from '../../../../shared/mcp_types';
import { MCP_MAX_TOOLS } from './limits';
import { mcpToolName } from './name';
import { mcpTool } from './tool';
import { closeMcpClients } from './close';
import { listMcpCatalog } from './catalog';

type Server = {
	id: string;
	name: string;
	client: McpClient;
	approval: McpApprovalPolicy | undefined;
	listed: Awaited<ReturnType<typeof listMcpCatalog>>;
};

export async function loadMcpTools(signal?: AbortSignal): Promise<{
	tools: Tool[];
	entries: DiscoveredMcpTool[];
	diagnostics: McpDiscoveryDiagnostics;
	onChanged: (listener: (entries: DiscoveredMcpTool[]) => void) => () => void;
	close: () => Promise<void>;
}> {
	const tools: Tool[] = [];
	const entries: DiscoveredMcpTool[] = [];
	const clients = new Set<McpClient>();
	const catalogs = new Map<string, Server>();
	const listeners = new Set<(entries: DiscoveredMcpTool[]) => void>();
	const servers = Object.entries(getMcpServers()).sort(([left], [right]) =>
		left.localeCompare(right)
	);
	const enabledServers = servers.filter(([, data]) => data.enabled !== false);
	const diagnostics: McpDiscoveryDiagnostics = {
		configuredServers: servers.length,
		enabledServers: enabledServers.length,
		connectedServers: 0,
		listedTools: 0,
		loadedTools: 0,
		rejectedTools: 0,
		truncated: false,
		failures: [],
	};
	let closed = false;

	const rebuild = () => {
		tools.length = 0;
		entries.length = 0;
		diagnostics.listedTools = 0;
		diagnostics.loadedTools = 0;
		diagnostics.rejectedTools = 0;
		diagnostics.truncated = false;
		diagnostics.failures = diagnostics.failures.filter(
			(failure) => failure.phase === 'connect' || failure.phase === 'list'
		);
		const usedNames = new Set<string>();
		for (const server of catalogs.values()) {
			diagnostics.listedTools += server.listed.length;
			for (const [index, listedTool] of server.listed.entries()) {
				if (tools.length >= MCP_MAX_TOOLS) {
					diagnostics.truncated = true;
					diagnostics.rejectedTools += server.listed.length - index;
					diagnostics.failures.push({ serverId: server.id, phase: 'limit' });
					break;
				}
				try {
					const runtimeName = mcpToolName(server.id, listedTool.name, usedNames);
					const configured = mcpTool(
						server.client,
						listedTool.name,
						listedTool.description ?? '',
						listedTool.inputSchema as JSONSchema,
						server.id,
						server.approval,
						runtimeName,
						listedTool.annotations?.readOnlyHint === true
					);
					tools.push(configured);
					entries.push({ tool: configured, serverId: server.id, serverName: server.name });
					usedNames.add(runtimeName);
					diagnostics.loadedTools += 1;
				} catch {
					diagnostics.rejectedTools += 1;
					diagnostics.failures.push({
						serverId: server.id,
						phase: 'schema',
						toolName: listedTool.name,
					});
				}
			}
		}
	};

	try {
		const discovered = await Promise.allSettled(
			enabledServers.map(async ([id, data]) => {
				signal?.throwIfAborted();
				let client: McpClient;
				try {
					client = await connect(id, data, 30_000, signal);
				} catch (error) {
					if (signal?.aborted) throw error;
					return { id, failure: 'connect' as const };
				}
				clients.add(client);
				try {
					return {
						id,
						client,
						name: data.name?.trim() || id,
						approval: data.require_approval,
						listed: await listMcpCatalog(client, signal),
					};
				} catch (error) {
					if (signal?.aborted) throw error;
					clients.delete(client);
					await close(client).catch(() => undefined);
					return { id, failure: 'list' as const };
				}
			})
		);
		const rejected = discovered.find(
			(result): result is PromiseRejectedResult => result.status === 'rejected'
		);
		if (rejected) throw rejected.reason;
		for (const result of discovered) {
			if (result.status !== 'fulfilled') continue;
			const server = result.value;
			if ('failure' in server && server.failure) {
				if (server.failure === 'list') diagnostics.connectedServers += 1;
				diagnostics.failures.push({ serverId: server.id, phase: server.failure });
				continue;
			}
			diagnostics.connectedServers += 1;
			catalogs.set(server.id, server);
		}
		rebuild();
		for (const server of catalogs.values()) {
			let pending = Promise.resolve();
			server.client.setNotificationHandler(ToolListChangedNotificationSchema, () => {
				pending = pending.then(async () => {
					if (closed) return;
					try {
						server.listed = await listMcpCatalog(server.client, signal);
						rebuild();
						for (const listener of listeners) listener([...entries]);
					} catch {
						if (!closed) diagnostics.failures.push({ serverId: server.id, phase: 'list' });
					}
				});
				return pending;
			});
		}
		return {
			tools,
			entries,
			diagnostics,
			onChanged(listener) {
				listeners.add(listener);
				return () => listeners.delete(listener);
			},
			close: async () => {
				closed = true;
				listeners.clear();
				for (const server of catalogs.values()) {
					server.client.removeNotificationHandler('notifications/tools/list_changed');
				}
				await closeMcpClients(clients);
			},
		};
	} catch (error) {
		await closeMcpClients(clients);
		throw error;
	}
}
