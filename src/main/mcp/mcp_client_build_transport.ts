import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {
	getDefaultEnvironment,
	StdioClientTransport,
} from '@modelcontextprotocol/sdk/client/stdio.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { McpData } from '../../shared/mcp_types';
import { isGitHubRemoteMcpUrl } from '../../shared/github_mcp';
import { googleOAuthOptions } from './google';
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
	if (isGitHubRemoteMcpUrl(data.url) && !data.token && !data.client_id) {
		throw new Error(
			'GitHub remote MCP requires a personal access token. GitHub does not support dynamic client registration.'
		);
	}
	const headers = data.token ? { Authorization: `Bearer ${data.token}` } : undefined;

	return new StreamableHTTPClientTransport(url, {
		fetch: createMcpFetch(),
		authProvider: createOAuthProvider({
			...googleOAuthOptions(
				data.url,
				data.client_id
					? { client_id: data.client_id, client_secret: data.client_secret }
					: getMcpOauth(id)
			),
			storage: {
				load: () => getMcpOauth(id),
				save: (state) => saveMcpOauth(id, state),
			},
			...(data.client_id ? { clientId: data.client_id, clientSecret: data.client_secret } : {}),
		}),
		requestInit: headers ? { headers } : undefined,
	});
}
