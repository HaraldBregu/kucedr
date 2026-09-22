import path from 'node:path';
import Store from 'electron-store';
import { userDataLocation } from '../shared/user_data_location';
import { openMcpRecord } from './mcp_record_open';
import { sealMcpRecord } from './mcp_record_seal';
import type { McpSecrets } from './mcp_secret_keys';
import type { McpRecord, McpStoreSchema } from './mcp_types';
import { restrictSettingsFile } from '../shared/restrict_settings_file';
import { isSafeStorageAvailable } from '../shared/safe_storage';
import { safeStorage } from 'electron';

type LegacyProvidersState = {
	mcp_servers?: unknown;
};

const legacySettingsDirectory = path.resolve(userDataLocation(), 'settings');
const mcpDirectory = path.resolve(userDataLocation(), 'mcp');

const legacyStore = new Store<LegacyProvidersState>({
	name: 'providers',
	cwd: legacySettingsDirectory,
	accessPropertiesByDotNotation: false,
});

const store = new Store<McpStoreSchema>({
	name: 'settings',
	cwd: mcpDirectory,
	accessPropertiesByDotNotation: false,
	defaults: { servers: [], localEnvironments: {} },
});

let volatileSecrets = new Map<string, McpSecrets>();
const volatileLocalEnvironments = new Map<
	string,
	{ identity: string; environment: Readonly<Record<string, string>> }
>();

function isMcpRecord(value: unknown): value is McpRecord {
	if (typeof value !== 'object' || value === null) return false;
	const record = value as Record<string, unknown>;
	return typeof record.id === 'string' && typeof record.type === 'string';
}

function isMcpRecordArray(value: unknown): value is McpRecord[] {
	return Array.isArray(value) && value.every(isMcpRecord);
}

function migrateLegacyMcpServers(): void {
	const legacyServers = legacyStore.get('mcp_servers');
	const hasLegacyServers = isMcpRecordArray(legacyServers);
	const migrated = getMcpServersState();
	if (migrated.length === 0 && hasLegacyServers) {
		setMcpServersState(legacyServers);
	}

	if (legacyStore.get('mcp_servers') !== undefined && typeof legacyStore.delete === 'function') {
		legacyStore.delete('mcp_servers');
	}
}

export const mcpStorePath = store.path;
restrictSettingsFile(mcpStorePath);

export function getMcpServersState(): McpRecord[] {
	let hasPlaintextSecrets = false;
	const servers = store.get('servers').map((stored) => {
		const opened = openMcpRecord(stored, volatileSecrets.get(stored.id));
		hasPlaintextSecrets ||= opened.hasPlaintextSecrets;
		return opened.record;
	});
	if (hasPlaintextSecrets) setMcpServersState(servers);
	return servers;
}

export function setMcpServersState(value: McpRecord[]): void {
	const nextVolatileSecrets = new Map<string, McpSecrets>();
	const servers = value.map((record) => {
		const sealed = sealMcpRecord(record);
		if (sealed.volatileSecrets) nextVolatileSecrets.set(record.id, sealed.volatileSecrets);
		return sealed.record;
	});
	volatileSecrets = nextVolatileSecrets;
	store.set('servers', servers);
	restrictSettingsFile(mcpStorePath);
}

export function getLocalMcpEnvironment(
	id: string,
	identity: string
): Readonly<Record<string, string>> | undefined {
	const volatile = volatileLocalEnvironments.get(id);
	if (volatile?.identity === identity) return volatile.environment;
	const encrypted = store.get('localEnvironments')[id];
	if (!encrypted || !isSafeStorageAvailable()) return undefined;
	try {
		const opened = JSON.parse(safeStorage.decryptString(Buffer.from(encrypted, 'base64'))) as {
			id?: unknown;
			identity?: unknown;
			env?: unknown;
		};
		if (
			opened.id !== id ||
			opened.identity !== identity ||
			!opened.env ||
			typeof opened.env !== 'object' ||
			Array.isArray(opened.env) ||
			Object.values(opened.env).some((value) => typeof value !== 'string')
		) {
			return undefined;
		}
		return opened.env as Record<string, string>;
	} catch {
		return undefined;
	}
}

export function setLocalMcpEnvironment(
	id: string,
	identity: string,
	environment: Readonly<Record<string, string>> | undefined
): void {
	const localEnvironments = { ...store.get('localEnvironments') };
	if (!environment || Object.keys(environment).length === 0) {
		delete localEnvironments[id];
		volatileLocalEnvironments.delete(id);
	} else if (isSafeStorageAvailable()) {
		localEnvironments[id] = safeStorage
			.encryptString(JSON.stringify({ id, identity, env: environment }))
			.toString('base64');
		volatileLocalEnvironments.delete(id);
	} else {
		delete localEnvironments[id];
		volatileLocalEnvironments.set(id, { identity, environment: { ...environment } });
	}
	store.set('localEnvironments', localEnvironments);
	restrictSettingsFile(mcpStorePath);
}

export function migrateMcpStoreFromProviders(): void {
	migrateLegacyMcpServers();
}
