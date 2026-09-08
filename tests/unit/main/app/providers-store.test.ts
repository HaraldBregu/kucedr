const mockStoreInstances: Array<{ store: Record<string, unknown> }> = [];

jest.mock('electron-store', () =>
	jest.fn().mockImplementation(({ defaults }: { defaults: Record<string, unknown> }) => {
		let backing: Record<string, unknown> = { ...defaults };
		const instance = {
			get(key: string) {
				return backing[key];
			},
			set(key: string, value: unknown) {
				backing[key] = value;
			},
			get store() {
				return backing;
			},
			set store(value: Record<string, unknown>) {
				backing = value;
			},
		};
		mockStoreInstances.push(instance);
		return instance;
	})
);

jest.mock('../../../../src/main/models', () => ({
	loadDatabases: () => [],
}));

jest.mock('../../../../src/main/storage/providers', () => ({
	storageProviders: { resolve: jest.fn() },
}));

import {
	getTaskConfiguration,
	listProviders,
	getProvider,
	hasProvider,
	setProvider,
	deleteProvider,
	clearProviders,
	getStorageSettings,
	saveStorageSettings,
	setTaskConfiguration,
} from '../../../../src/main/settings_store';
import { getDatabaseConfiguration } from '../../../../src/main/database/database_store';
import type { StoredProvider } from '../../../../src/shared/provider_types';
import { storageProviders } from '../../../../src/main/storage/providers';

function provider(id: string, name: string): StoredProvider {
	return { id, name, apiKey: 'k', baseUrl: 'https://api' };
}

beforeEach(() => clearProviders());

describe('providers in app settings', () => {
	it('sets and reads a provider', () => {
		setProvider(provider('openai', 'OpenAI'));
		expect(getProvider('openai')).toEqual(provider('openai', 'OpenAI'));
		expect(hasProvider('openai')).toBe(true);
	});

	it('persists only encrypted credential data and provider identifiers', () => {
		setProvider({
			...provider('openai', 'OpenAI'),
			apiKey: 'plaintext-provider-secret',
			baseUrl: 'https://plaintext-provider-url.example',
		});

		const persisted = JSON.stringify(mockStoreInstances.map((instance) => instance.store));
		expect(persisted).not.toContain('plaintext-provider-secret');
		expect(persisted).not.toContain('https://plaintext-provider-url.example');
	});

	it('returns undefined / false for unknown providers', () => {
		expect(getProvider('missing')).toBeUndefined();
		expect(hasProvider('missing')).toBe(false);
	});

	it('stores providers as a list', () => {
		setProvider(provider('a', 'A'));
		setProvider(provider('b', 'B'));
		const list = listProviders();
		expect(Array.isArray(list)).toBe(true);
		expect(list.map((entry) => entry.id)).toEqual(['a', 'b']);
	});

	it('stores database credentials separately from renderer-facing configuration', () => {
		setProvider(provider('pinecone', 'Pinecone'), 'databases');

		expect(getProvider('pinecone', 'databases')).toEqual(provider('pinecone', 'Pinecone'));
		expect(getDatabaseConfiguration()).toEqual({
			providerId: undefined,
			databaseId: undefined,
		});
	});

	it('updates in place instead of appending a duplicate', () => {
		setProvider(provider('openai', 'OpenAI'));
		setProvider({ ...provider('openai', 'OpenAI'), apiKey: 'rotated' });
		expect(listProviders()).toHaveLength(1);
		expect(getProvider('openai')?.apiKey).toBe('rotated');
	});

	it('lists only well-formed provider entries', () => {
		setProvider(provider('good', 'Good'));
		setProvider({ id: 'bad' } as StoredProvider);
		expect(listProviders().map((entry) => entry.id)).toEqual(['good']);
	});

	it('deletes a provider', () => {
		setProvider(provider('x', 'X'));
		deleteProvider('x');
		expect(hasProvider('x')).toBe(false);
	});

	it('deleteProvider is a no-op for unknown ids', () => {
		expect(() => deleteProvider('nope')).not.toThrow();
	});

	it('clears all providers', () => {
		setProvider(provider('a', 'A'));
		clearProviders();
		expect(listProviders()).toEqual([]);
	});
});

describe('storage sync in app settings', () => {
	it('round-trips folder sync and cron settings', () => {
		const settings = {
			providerId: 'a00c674a-c8c8-4d01-930f-ad690b3d0123',
			paths: ['/data/agent'],
			syncEnabled: true,
			syncCronExpression: '0 3 * * *',
		};
		saveStorageSettings(settings);
		expect(getStorageSettings()).toEqual(settings);
		expect(storageProviders.resolve).toHaveBeenCalledWith(settings.providerId);
	});

	it('rejects a missing selected provider without changing saved settings', () => {
		const before = getStorageSettings();
		(storageProviders.resolve as jest.Mock).mockImplementationOnce(() => {
			throw new Error('not found');
		});
		expect(() =>
			saveStorageSettings({
				paths: [],
				providerId: 'b00c674a-c8c8-4d01-930f-ad690b3d0123',
				syncEnabled: false,
				syncCronExpression: '0 3 * * *',
			})
		).toThrow('not found');
		expect(getStorageSettings()).toEqual(before);
	});

	it('requires a provider before enabling scheduled sync', () => {
		(storageProviders.resolve as jest.Mock).mockImplementationOnce(() => {
			throw new Error('Select a storage provider');
		});
		expect(() =>
			saveStorageSettings({ paths: [], syncEnabled: true, syncCronExpression: '0 3 * * *' })
		).toThrow('Select a storage provider');
	});

	it('rejects an invalid cron schedule', () => {
		expect(() =>
			saveStorageSettings({
				paths: ['/data/agent'],
				syncEnabled: true,
				syncCronExpression: 'not cron',
			})
		).toThrow('valid cron expression');
	});
});

describe('cron settings', () => {
	it('preserves the persisted cron structure', () => {
		const state = {
			enabled: true,
			providerId: 'openai',
			modelId: 'gpt-5',
			schedules: [],
		};

		setTaskConfiguration(state);
		expect(getTaskConfiguration()).toEqual(state);
	});
});
