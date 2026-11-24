import { safeStorage } from 'electron';
import { configuredPluginSettings } from '../../../../src/main/plugins/configured';
import { pluginSettings } from '../../../../src/main/plugins/plugins_settings';
import { savePluginSettings } from '../../../../src/main/plugins/plugins_save_settings';
import { pluginsStore } from '../../../../src/main/plugins/plugins_store';

jest.mock('electron', () => ({
	safeStorage: {
		isEncryptionAvailable: () => true,
		getSelectedStorageBackend: () => 'keychain',
		encryptString: (value: string) => Buffer.from(`encrypted:${value}`),
		decryptString: jest.fn((value: Buffer) => value.toString().replace(/^encrypted:/, '')),
	},
}));
jest.mock('../../../../src/main/plugins/plugins_store', () => {
	const state: Record<string, unknown> = { settings: {}, secrets: {} };
	return {
		pluginsStore: {
			get: (key: string) => state[key],
			set: (values: Record<string, unknown>) => Object.assign(state, values),
		},
	};
});
jest.mock('../../../../src/main/plugins/plugins_scan', () => ({
	scanPlugins: () => [
		{
			id: 'openai',
			manifest: { settings: { inputSchema: { properties: { apiKey: { format: 'password' }, clientId: { type: 'string' } } } } },
		},
	],
}));

beforeEach(() => {
	pluginsStore.set({ settings: {}, secrets: {} });
	jest.clearAllMocks();
});

it('encrypts plugin API keys and restores them for provider use', () => {
	savePluginSettings('openai', { apiKey: ' secret-value ' });
	expect(pluginsStore.get('settings')).toEqual({ openai: {} });
	expect(JSON.stringify(pluginsStore.get('secrets'))).not.toContain('secret-value');
	expect(pluginSettings('openai')).toEqual({ apiKey: 'secret-value' });
});

it('returns only configured field names, including legacy fields, without decrypting', () => {
	pluginsStore.set({ settings: { openai: { apiKey: 'legacy-key' } } });
	expect(configuredPluginSettings('openai')).toEqual(['apiKey']);
	savePluginSettings('openai', { apiKey: 'replacement', clientId: 'client-id' });
	expect(configuredPluginSettings('openai')).toEqual(['clientId', 'apiKey']);
	expect(safeStorage.decryptString).not.toHaveBeenCalled();
	expect(pluginsStore.get('settings')).toEqual({ openai: { clientId: 'client-id' } });
});

it('updates and resets one field while preserving its siblings', () => {
	savePluginSettings('openai', { apiKey: 'api-key', clientId: 'old-client' });
	const sealedKey = pluginsStore.get('secrets').openai.apiKey;
	savePluginSettings('openai', { clientId: 'new-client' });
	expect(pluginsStore.get('secrets').openai.apiKey).toBe(sealedKey);
	expect(safeStorage.decryptString).not.toHaveBeenCalled();
	expect(pluginSettings('openai')).toEqual({ apiKey: 'api-key', clientId: 'new-client' });

	savePluginSettings('openai', { apiKey: null });
	expect(configuredPluginSettings('openai')).toEqual(['clientId']);
	expect(pluginSettings('openai')).toEqual({ clientId: 'new-client' });
});
