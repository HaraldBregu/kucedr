import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {
	getDefaultEnvironment,
	StdioClientTransport,
} from '@modelcontextprotocol/sdk/client/stdio.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { McpData } from '../../shared/mcp_types';
import { createOAuthProvider } from './mcp_oauth_create_provider';
import { getMcpOauth, saveMcpOauth } from './mcp_store';
import { createMcpFetch } from './mcp_fetch';
import { parseMcpUrl } from './url';

export function buildTransport(id: string, data: McpData): Transport {
	if (data.type === 'stdio') {
		return new StdioClientTransport({
			command: data.command,
			args: data.args ? [...data.args] : undefined,
			env: data.env ? { ...getDefaultEnvironment(), ...data.env } : undefined,
			cwd: data.cwd ?? process.cwd(),
		});
	}

	const url = parseMcpUrl(data.url);
	const headers = data.token ? { Authorization: `Bearer ${data.token}` } : undefined;

	return new StreamableHTTPClientTransport(url, {
		fetch: createMcpFetch(),
		authProvider: createOAuthProvider({
			storage: {
				load: () => getMcpOauth(id),
				save: (state) => saveMcpOauth(id, state),
			},
			clientId: data.client_id,
			clientSecret: data.client_secret,
		}),
		requestInit: headers ? { headers } : undefined,
	});
}
