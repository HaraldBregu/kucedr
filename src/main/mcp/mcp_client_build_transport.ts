import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {
	getDefaultEnvironment,
	StdioClientTransport,
} from '@modelcontextprotocol/sdk/client/stdio.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { McpData } from '../../shared/mcp_types';
import { findMcpService } from './manifest';
import { mcpOAuthOptions } from './oauth_options';
import { createOAuthProvider } from './mcp_oauth_create_provider';
import { getMcpOauth, saveMcpOauth } from './mcp_store';
import { createMcpFetch } from './mcp_fetch';
import { createGoogleMcpFetch } from './mcp_google_fetch';
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
	const service = findMcpService(data.url);
	if (service?.oauth?.credentials_required && !data.token && !data.client_id) {
		throw new Error(
			'GitHub remote MCP requires a personal access token. GitHub does not support dynamic client registration.'
		);
	}
	const headers = data.token ? { Authorization: `Bearer ${data.token}` } : undefined;
	const managedCredentials = Boolean(service?.oauth?.client_id_env);

	return new StreamableHTTPClientTransport(url, {
		fetch: service?.oauth?.google_fetch ? createGoogleMcpFetch() : createMcpFetch(),
		authProvider: createOAuthProvider({
			...mcpOAuthOptions(data.url),
			storage: {
				load: () => getMcpOauth(id),
				save: (state) => saveMcpOauth(id, state),
			},
			...(managedCredentials
				? {}
				: data.client_id
					? { clientId: data.client_id, clientSecret: data.client_secret }
					: {}),
		}),
		requestInit: headers ? { headers } : undefined,
	});
}
