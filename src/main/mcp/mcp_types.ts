import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type {
	OAuthClientInformationFull,
	OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js';
import type { McpData } from '../../shared/mcp_types';

export type McpClient = Client;

export type McpCallResult = {
	content?: unknown;
	isError?: boolean;
};

export type McpListToolsResult = ReturnType<Client['listTools']>;

export type McpCallToolResult = ReturnType<Client['callTool']>;

export type McpOAuthState = Partial<OAuthClientInformationFull> & {
	tokens?: OAuthTokens;
	codeVerifier?: string;
};

export type McpRecord = McpData & McpOAuthState & { readonly id: string };

export type McpStoredRecord = {
	readonly id: string;
	readonly type: string;
	readonly encryptedSecrets?: string;
	readonly [key: string]: unknown;
};

export type McpStoreSchema = {
	readonly servers: McpStoredRecord[];
	readonly localEnvironments: Record<string, string>;
};

export type McpOAuthStorage = {
	load: () => McpOAuthState;
	save: (state: McpOAuthState) => void;
};

export type McpOAuthProviderParams = {
	serverUrl?: string;
	storage: McpOAuthStorage;
	clientId?: string;
	clientSecret?: string;
	onRedirect?: (url: URL) => void;
};
