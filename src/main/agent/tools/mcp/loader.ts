import { close, connect, getMcpServers, listTools, type McpClient } from '../../../mcp';
import type { JSONSchema, McpDiscoveryDiagnostics, Tool } from '../../types';
import { MCP_MAX_TOOLS } from './limits';
import { mcpToolName } from './name';
import { mcpTool } from './tool';
import { closeMcpClients } from './close';

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
	diagnostics: McpDiscoveryDiagnostics;
	close: () => Promise<void>;
}> {
	const tools: Tool[] = [];
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
	try {
		const discovered = await Promise.allSettled(
			enabledServers.map(async ([id, data]): Promise<DiscoveredServer> => {
				signal?.throwIfAborted();
				let client: McpClient;
				try {
					client = await connect(id, data, 30_000, signal);
				} catch (error) {
					if (signal?.aborted) throw error;
					return { id, failure: 'connect' };
				}
				clients.add(client);
				try {
					return {
						id,
						client,
						approval: data.require_approval,
						listed: await listTools(client, 30_000, signal),
					};
				} catch (error) {
					if (signal?.aborted) throw error;
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

		for (const settled of discovered) {
			if (settled.status !== 'fulfilled') continue;
			const result = settled.value;
			if ('failure' in result) {
				if (result.failure === 'connect') {
					diagnostics.failures.push({ serverId: result.id, phase: 'connect' });
					continue;
				}
				diagnostics.connectedServers += 1;
				diagnostics.failures.push({ serverId: result.id, phase: 'list' });
				continue;
			}
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
					tools.push(
						mcpTool(
							result.client,
							listedTool.name,
							listedTool.description ?? '',
							listedTool.inputSchema as JSONSchema,
							result.id,
							result.approval,
							runtimeName,
							listedTool.annotations?.readOnlyHint === true
						)
					);
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

		return {
			tools,
			diagnostics,
			close: () => closeMcpClients(clients),
		};
	} catch (error) {
		await closeMcpClients(clients);
		throw error;
	}
}
