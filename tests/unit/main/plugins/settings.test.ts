import { pluginSettings } from '../../../../src/main/plugins/plugins_settings';
import { savePluginSettings } from '../../../../src/main/plugins/plugins_save_settings';
import { pluginsStore } from '../../../../src/main/plugins/plugins_store';

jest.mock('electron', () => ({
	safeStorage: {
		isEncryptionAvailable: () => true,
		getSelectedStorageBackend: () => 'keychain',
		encryptString: (value: string) => Buffer.from(`encrypted:${value}`),
		decryptString: (value: Buffer) => value.toString().replace(/^encrypted:/, ''),
	},
}));
jest.mock('../../../../src/main/plugins/plugins_store', () => {
	const state: Record<string, unknown> = { settings: {}, secrets: {} };
	return { pluginsStore: { get: (key: string) => state[key], set: (key: string, value: unknown) => { state[key] = value; } } };
});
jest.mock('../../../../src/main/plugins/plugins_scan', () => ({
	scanPlugins: () => [{ id: 'openai', manifest: { settings: { inputSchema: { properties: { apiKey: { format: 'password' } } } } } }],
}));

it('encrypts plugin API keys and restores them for provider use', () => {
	savePluginSettings('openai', { apiKey: ' secret-value ' });
	expect(pluginsStore.get('settings')).toEqual({ openai: {} });
	expect(JSON.stringify(pluginsStore.get('secrets'))).not.toContain('secret-value');
	expect(pluginSettings('openai')).toEqual({ apiKey: 'secret-value' });
});
