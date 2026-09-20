import { MCP_APPROVAL_POLICIES } from './mcp_definitions';

export type McpApprovalPolicy = (typeof MCP_APPROVAL_POLICIES)[number];

interface McpBase {
	readonly name?: string;
	readonly require_approval?: McpApprovalPolicy;
	readonly defer_loading?: boolean;
	readonly enabled?: boolean;
	readonly created_at?: string;
	readonly updated_at?: string;
	readonly last_error?: string;
}

export interface McpHttpData extends McpBase {
	readonly type: 'http';
	readonly url: string;
	readonly token?: string;
	readonly client_id?: string;
	readonly client_secret?: string;
	readonly refresh_token?: string;
	readonly token_expires_at?: string;
	readonly last_refreshed_at?: string;
}

export interface McpStdioData extends McpBase {
	readonly type: 'stdio';
	readonly command: string;
	readonly args?: readonly string[];
	readonly env?: Readonly<Record<string, string>>;
	readonly cwd?: string;
}

export type McpData = McpHttpData | McpStdioData;

export type McpSettings = Record<string, McpData>;

export type McpOAuthStart = { status: 'authorized' };

export type McpServerSource = 'configured' | 'local';

export type McpServerInfo = {
	readonly id: string;
	readonly source: McpServerSource;
	readonly data: McpData;
	readonly path?: string;
	readonly diagnostic?: string;
};

export type McpLocalDiagnostic = {
	readonly name: string;
	readonly path: string;
	readonly error: string;
};

export type McpRegistry = {
	readonly servers: readonly McpServerInfo[];
	readonly diagnostics: readonly McpLocalDiagnostic[];
};

export type McpLocalImportSkipped = {
	readonly name: string;
	readonly path: string;
	readonly reason: string;
};

export type McpLocalImportResult = {
	readonly imported: readonly McpServerInfo[];
	readonly skipped: readonly McpLocalImportSkipped[];
};

export type McpTestResult = {
	readonly ok: boolean;
	readonly tools: readonly string[];
	readonly toolCount: number;
	readonly durationMs: number;
	readonly error?: string;
};
