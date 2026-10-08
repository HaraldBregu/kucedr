import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { app } from 'electron';
import type { McpData } from '../../shared/mcp_types';
import type { McpClient } from './mcp_types';
import { buildTransport } from './mcp_client_build_transport';

export async function connect(
	id: string,
	data: McpData,
	timeout = 300_000,
	signal?: AbortSignal
): Promise<McpClient> {
	const client = new Client({ name: 'kucedr', version: app.getVersion() });
	try {
		await client.connect(buildTransport(id, data), { timeout, signal });
		return client;
	} catch (error) {
		await client.close().catch(() => {});
		throw error;
	}
}
