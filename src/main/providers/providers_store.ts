import path from 'node:path';
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
