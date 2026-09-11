import { createDecipheriv } from 'node:crypto';
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { safeStorage } from 'electron';
import Store from 'electron-store';
import { userDataLocation } from '../shared/user_data_location';
import type { ProviderCredentialKind, StoredProvider } from '../../shared/provider_types';
import type { ProvidersStoreState } from './providers_types';
import { restrictProviderPermissions } from './restrict';

const defaults: ProvidersStoreState = {
	models: [],
	databases: [],
	search_engines: [],
};

const store = new Store<ProvidersStoreState>({
	name: 'providers',
	cwd: path.resolve(userDataLocation(), 'settings'),
	accessPropertiesByDotNotation: false,
	defaults,
});

export const providersStorePath = store.path;

migrateLegacyProviders();

export function getModelProvidersState(): StoredProvider[] {
	return section('models');
}

export function setModelProvidersState(value: StoredProvider[]): void {
	setSection('models', value);
}

export function getDatabaseProvidersState(): StoredProvider[] {
	return section('databases');
}

export function setDatabaseProvidersState(value: StoredProvider[]): void {
	setSection('databases', value);
}

export function getSearchEngines(): StoredProvider[] {
	return section('search_engines');
}

export function setSearchEngines(value: StoredProvider[]): void {
	setSection('search_engines', value);
}

function setSection(kind: ProviderCredentialKind, value: StoredProvider[]): void {
	writeSection(kind, value.filter(isStoredProvider));
}

function section(kind: ProviderCredentialKind): StoredProvider[] {
	const value = store.get(kind);
	return Array.isArray(value) ? value.filter(isStoredProvider) : [];
}

function writeSection(kind: ProviderCredentialKind, value: StoredProvider[]): void {
	store.set(kind, value);
	if (typeof store.path === 'string') {
		restrictProviderPermissions(path.dirname(store.path), store.path);
	}
}

function migrateLegacyProviders(): void {
	const legacyPath = path.resolve(userDataLocation(), 'settings', 'provider-vault.json');
	if (!existsSync(legacyPath) || !safeStorage.isEncryptionAvailable()) return;
	try {
		const legacy = JSON.parse(readFileSync(legacyPath, 'utf8')) as Record<string, unknown>;
		const protectedKey = legacy.protectedKey;
		const records = legacy.records;
		if (typeof protectedKey !== 'string' || !records || typeof records !== 'object') return;
		const key = Buffer.from(
			safeStorage.decryptString(Buffer.from(protectedKey, 'base64')),
			'base64'
		);
		if (key.byteLength !== 32) return;
		try {
			const providers = new Map<ProviderCredentialKind, Map<string, StoredProvider>>(
				(['models', 'databases', 'search_engines'] as const).map((kind) => [
					kind,
					new Map(section(kind).map((provider) => [provider.id, provider])),
				])
			);
			let complete = true;
			for (const record of Object.values(records)) {
				const provider = openLegacyProvider(record, key);
				if (provider) providers.get(provider.kind)?.set(provider.value.id, provider.value);
				else if (
					!record ||
					typeof record !== 'object' ||
					!(record as Record<string, unknown>).tombstoneAt
				)
					complete = false;
			}
			for (const [kind, values] of providers) writeSection(kind, [...values.values()]);
			if (complete) unlinkSync(legacyPath);
		} finally {
			key.fill(0);
		}
	} catch {}
}

function openLegacyProvider(
	record: unknown,
	key: Buffer
): { kind: ProviderCredentialKind; value: StoredProvider } | undefined {
	if (!record || typeof record !== 'object') return undefined;
	const value = record as Record<string, unknown>;
	const kind = value.kind;
	const providerId = value.providerId;
	const vaultId = value.vaultId;
	const schemaVersion = value.schemaVersion;
	if (
		(value.tombstoneAt ||
			(kind !== 'models' && kind !== 'databases' && kind !== 'search_engines') ||
			typeof providerId !== 'string' ||
			typeof vaultId !== 'string' ||
			typeof schemaVersion !== 'number' ||
			typeof value.ciphertext !== 'string' ||
			typeof value.nonce !== 'string' ||
			typeof value.tag !== 'string')
	)
		return undefined;
	try {
		const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(value.nonce, 'base64'));
		decipher.setAAD(
			Buffer.from(JSON.stringify([vaultId, kind, providerId, schemaVersion]), 'utf8')
		);
		decipher.setAuthTag(Buffer.from(value.tag, 'base64'));
		const opened = JSON.parse(
			Buffer.concat([decipher.update(Buffer.from(value.ciphertext, 'base64')), decipher.final()]).toString(
				'utf8'
			)
		) as Omit<StoredProvider, 'id'>;
		if (
			typeof opened.name !== 'string' ||
			typeof opened.apiKey !== 'string' ||
			typeof opened.baseUrl !== 'string'
		)
			return undefined;
		return { kind, value: { id: providerId, ...opened } };
	} catch {
		return undefined;
	}
}

function isStoredProvider(value: unknown): value is StoredProvider {
	if (typeof value !== 'object' || value === null) return false;
	const provider = value as Partial<StoredProvider>;
	return (
		typeof provider.id === 'string' &&
		typeof provider.name === 'string' &&
		typeof provider.apiKey === 'string' &&
		typeof provider.baseUrl === 'string'
	);
}
