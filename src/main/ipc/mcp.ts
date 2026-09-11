import { dialog, shell } from 'electron';
import { mkdirSync } from 'node:fs';
import { auth } from '@modelcontextprotocol/sdk/client/auth.js';
import type { EventBus } from '../event_bus';
import { McpChannels } from '../../shared/ipc_channels_definitions';
import {
	createOAuthProvider,
	configureLocalMcpServer,
	deleteMcpServer,
	getMcpOauth,
	getMcpServers,
	importLocalMcpServers,
	listConfiguredMcpServers,
	listMcpRegistry,
	mcpLocalRoot,
	saveMcpOauth,
	setMcpServers,
	startOauthCallbackServer,
	testMcpServer,
	upsertMcpServer,
	type McpOAuthStorage,
} from '../mcp';
import type { McpData, McpOAuthStart, McpSettings } from '../../shared/mcp_types';
import { registerCommandWithEvent, registerQueryWithEvent } from './core/gateway';
import type { IpcModule } from './core/module';
import type { AppRegistry } from '../apps/app_registry';
import type { WindowContextManager } from '../window_context';
import { TrustedRenderer } from './core/trusted';
import { parseMcpUrl } from '../mcp/url';

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function resolveMcpId(value: string | undefined): string {
	const id = value?.trim().toLowerCase();
	if (!id) throw new Error('Connector ID is required.');
	return id;
}

function inferMcpType(entry: McpData): McpData {
	const shape = entry as { type?: string; command?: unknown; url?: unknown };
	if (shape.type) return entry;
	if (typeof shape.command === 'string') return { ...entry, type: 'stdio' } as McpData;
	if (typeof shape.url === 'string') return { ...entry, type: 'http' } as McpData;
	return entry;
}

function isStringRecord(value: unknown): value is Record<string, string> {
	if (!isRecord(value)) return false;
	return Object.values(value).every((item) => typeof item === 'string');
}

function hasCommonMcpFields(value: Record<string, unknown>): boolean {
	return (
		(value.name === undefined || typeof value.name === 'string') &&
		(value.require_approval === undefined ||
			value.require_approval === 'always' ||
			value.require_approval === 'never') &&
		(value.defer_loading === undefined || typeof value.defer_loading === 'boolean') &&
		(value.enabled === undefined || typeof value.enabled === 'boolean') &&
		(value.created_at === undefined || typeof value.created_at === 'string') &&
		(value.updated_at === undefined || typeof value.updated_at === 'string') &&
		(value.last_error === undefined || typeof value.last_error === 'string')
	);
}

function isMcpEntry(value: unknown): value is McpData {
	if (!isRecord(value)) return false;
	if (value.type === 'stdio') {
		return (
			typeof value.command === 'string' &&
			(value.args === undefined || Array.isArray(value.args)) &&
			(value.args === undefined || value.args.every((item) => typeof item === 'string')) &&
			(value.env === undefined || isStringRecord(value.env)) &&
			(value.cwd === undefined || typeof value.cwd === 'string') &&
			hasCommonMcpFields(value)
		);
	}
	if (value.type === 'http') {
		if (typeof value.url !== 'string') return false;
		try {
			parseMcpUrl(value.url);
		} catch {
			return false;
		}
		return (
			(value.token === undefined || typeof value.token === 'string') &&
			(value.client_id === undefined || typeof value.client_id === 'string') &&
			(value.client_secret === undefined || typeof value.client_secret === 'string') &&
			hasCommonMcpFields(value)
		);
	}
	return false;
}

function normalizeMcpSettings(value: unknown): McpSettings {
	if (!isRecord(value)) return {};
	const connectors: McpSettings = {};
	for (const [rawId, rawEntry] of Object.entries(value)) {
		const id = rawId.trim().toLowerCase();
		if (!id || !isMcpEntry(rawEntry)) continue;
		connectors[id] = rawEntry;
	}
	return connectors;
}

function listMcp(): McpSettings {
	const servers = listConfiguredMcpServers();
	const out: McpSettings = {};
	for (const [id, entry] of Object.entries(servers)) out[id] = inferMcpType(entry);
	return out;
}

function oauthStorage(id: string): McpOAuthStorage {
	return {
		load: () => getMcpOauth(id),
		save: (state) => saveMcpOauth(id, state),
	};
}

function getHttpMcpServer(id: string): {
	id: string;
	url: string;
	clientId?: string;
	clientSecret?: string;
} {
	const connectorId = resolveMcpId(id);
	const entry = getMcpServers()[connectorId];
	if (!entry || entry.type !== 'http') throw new Error(`No http MCP server "${id}".`);
	const oauth = getMcpOauth(connectorId);
	return {
		id: connectorId,
		url: entry.url,
		clientId: oauth.client_id ?? entry.client_id,
		clientSecret: oauth.client_secret,
	};
}

export interface McpIpcDeps {
	windows: WindowContextManager;
	apps: AppRegistry;
}

export class McpIpc implements IpcModule<McpIpcDeps> {
	readonly name = 'mcp';

	register({ windows, apps }: McpIpcDeps, _eventBus: EventBus): void {
		const trusted = new TrustedRenderer(windows, apps);

		registerQueryWithEvent(McpChannels.list, (event) => {
			trusted.assert(event);
			return listMcp();
		});

		registerQueryWithEvent(McpChannels.get, (event, id: string) => {
			trusted.assert(event);
			const connectorId = resolveMcpId(id);
			const connector = listMcp()[connectorId];
			return connector ? { [connectorId]: connector } : {};
		});

		registerCommandWithEvent(McpChannels.save, (event, input: McpSettings) => {
			trusted.assert(event);
			const next = normalizeMcpSettings(input);
			setMcpServers(next);
			return listMcp();
		});

		registerCommandWithEvent(McpChannels.upsert, (event, id: string, input: McpData) => {
			trusted.assert(event);
			const connectorId = resolveMcpId(id);
			const entry = normalizeMcpSettings({ [connectorId]: input })[connectorId];
			if (!entry) throw new Error('Invalid MCP server configuration.');
			upsertMcpServer(connectorId, entry);
			return listMcp();
		});

		registerCommandWithEvent(McpChannels.delete, (event, id: string) => {
			trusted.assert(event);
			const connectorId = resolveMcpId(id);
			deleteMcpServer(connectorId);
		});

		registerQueryWithEvent(McpChannels.registry, (event) => {
			trusted.assert(event);
			return listMcpRegistry();
		});

		registerCommandWithEvent(McpChannels.importLocal, async (event) => {
			const window = trusted.assert(event);
			const options: Electron.OpenDialogOptions = {
				title: 'Import local MCP servers',
				properties: ['openDirectory', 'multiSelections'],
			};
			const result = window
				? await dialog.showOpenDialog(window, options)
				: await dialog.showOpenDialog(options);
			if (result.canceled) return undefined;
			return importLocalMcpServers(result.filePaths);
		});

		registerCommandWithEvent(McpChannels.configureLocal, (event, id, input) => {
			trusted.assert(event);
			return configureLocalMcpServer(resolveMcpId(id), input);
		});

		registerQueryWithEvent(McpChannels.getRoot, (event) => {
			trusted.assert(event);
			return mcpLocalRoot();
		});

		registerCommandWithEvent(McpChannels.openRoot, async (event) => {
			trusted.assert(event);
			const root = mcpLocalRoot();
			mkdirSync(root, { recursive: true });
			const error = await shell.openPath(root);
			if (error) throw new Error(error);
		});

		registerCommandWithEvent(McpChannels.test, (event, id: string) => {
			trusted.assert(event);
			const connectorId = resolveMcpId(id);
			return testMcpServer(connectorId);
		});

		registerCommandWithEvent(
			McpChannels.oauthStart,
			async (event, id: string): Promise<McpOAuthStart> => {
				trusted.assert(event);
				const server = getHttpMcpServer(id);
				let redirectUrl: string | undefined;
				const provider = () =>
					createOAuthProvider({
						storage: oauthStorage(server.id),
						clientId: server.clientId,
						clientSecret: server.clientSecret,
						onRedirect: (url) => {
							redirectUrl = url.toString();
						},
					});
				const result = await auth(provider(), { serverUrl: server.url });
				if (result === 'AUTHORIZED') return { status: 'authorized' };
				if (!redirectUrl)
					throw new Error(`MCP server "${id}" did not return an authorization URL.`);

				let callback: Awaited<ReturnType<typeof startOauthCallbackServer>>;
				try {
					callback = await startOauthCallbackServer();
				} catch {
					// ponytail: callback port busy → fall back to the manual paste flow
					return { status: 'redirect', url: redirectUrl };
				}
				try {
					await shell.openExternal(redirectUrl);
					const code = await callback.code;
					const finish = await auth(provider(), { serverUrl: server.url, authorizationCode: code });
					if (finish !== 'AUTHORIZED') throw new Error(`OAuth authorization failed for "${id}".`);
					return { status: 'authorized' };
				} finally {
					callback.close();
				}
			}
		);

		registerCommandWithEvent(
			McpChannels.oauthFinish,
			async (event, id: string, code: string): Promise<void> => {
				trusted.assert(event);
				const server = getHttpMcpServer(id);
				const result = await auth(
					createOAuthProvider({
						storage: oauthStorage(server.id),
						clientId: server.clientId,
						clientSecret: server.clientSecret,
					}),
					{ serverUrl: server.url, authorizationCode: code }
				);
				if (result !== 'AUTHORIZED') throw new Error(`OAuth authorization failed for "${id}".`);
			}
		);
	}
}
