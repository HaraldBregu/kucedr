import { close, connect, getMcpServers, getMcpToolCatalog, type McpClient } from '../../../mcp';
import type { JSONSchema, McpDiscoveryDiagnostics, Tool } from '../../types';
import type { DiscoveredMcpTool } from '../../runner/run_discovery';
import { MCP_MAX_TOOLS } from './limits';
import { mcpToolName } from './name';
import { mcpTool } from './tool';

export async function loadMcpTools(signal?: AbortSignal): Promise<{
	tools: Tool[];
	entries: DiscoveredMcpTool[];
	diagnostics: McpDiscoveryDiagnostics;
	onChanged: (listener: (entries: DiscoveredMcpTool[]) => void) => () => void;
	close: () => Promise<void>;
}> {
	signal?.throwIfAborted();
	const tools: Tool[] = [];
	const entries: DiscoveredMcpTool[] = [];
	const connections = new Map<string, Promise<McpClient>>();
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
	const usedNames = new Set<string>();
	let closed = false;

	for (const [id, data] of enabledServers) {
		const listed = getMcpToolCatalog(id);
		if (!listed) continue;
		for (const [index, listedTool] of listed.entries()) {
			if (tools.length >= MCP_MAX_TOOLS) {
				diagnostics.truncated = true;
				diagnostics.rejectedTools += listed.length - index;
				diagnostics.failures.push({ serverId: id, phase: 'limit' });
				break;
			}
			try {
				const runtimeName = mcpToolName(id, listedTool.name, usedNames);
				const configured = mcpTool(
					async () => {
						if (closed) throw new Error('MCP run has ended.');
						let connection = connections.get(id);
						if (!connection) {
							connection = connect(id, data, 30_000, signal)
								.then(async (client) => {
									if (closed) {
										await close(client).catch(() => undefined);
										throw new Error('MCP run has ended.');
									}
									diagnostics.connectedServers += 1;
									return client;
								})
								.catch((error) => {
									connections.delete(id);
									throw error;
								});
							connections.set(id, connection);
						}
						return connection;
					},
					listedTool.name,
					listedTool.description ?? '',
					listedTool.inputSchema as JSONSchema,
					id,
					data.require_approval,
					runtimeName,
					listedTool.annotations?.readOnlyHint === true
				);
				tools.push(configured);
				entries.push({ tool: configured, serverId: id, serverName: data.name?.trim() || id });
				usedNames.add(runtimeName);
				diagnostics.loadedTools += 1;
			} catch {
				diagnostics.rejectedTools += 1;
				diagnostics.failures.push({ serverId: id, phase: 'schema', toolName: listedTool.name });
			}
		}
	}

	return {
		tools,
		entries,
		diagnostics,
		onChanged: () => () => undefined,
		close: async () => {
			if (closed) return;
			closed = true;
			const clients = await Promise.allSettled(connections.values());
			connections.clear();
			await Promise.allSettled(
				clients
					.filter((result): result is PromiseFulfilledResult<McpClient> => result.status === 'fulfilled')
					.map((result) => close(result.value))
			);
		},
	};
}
