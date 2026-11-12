import path from 'node:path';
import { readPlugin } from '../../../../src/main/plugins/plugins_read';
import { Coder } from '../../../../src/main/coding/coding';
import { HARNESS_PROTOCOLS } from '../../../../src/main/coding/harness/protocols';

jest.mock('../../../../src/main/plugins/plugins_providers', () => ({
	pluginProviders: () => {
		const directory = path.resolve('resources/plugins/openai');
		const plugin = readPlugin(directory, 'openai', true);
		return [{ directory, manifest: plugin.provider, plugin: { id: 'openai', name: 'OpenAI' } }];
	},
}));

jest.mock('../../../../src/main/coding/harness/protocols', () => ({
	HARNESS_PROTOCOLS: { 'app-server': jest.fn() },
}));

it('constructs and reuses the bundled Codex harness using its manifest and existing credential key', async () => {
	const listModels = jest.fn().mockResolvedValue({ providers: [] });
	const destroy = jest.fn();
	const factory = jest.mocked(HARNESS_PROTOCOLS['app-server']);
	factory.mockReturnValue({ listModels, destroy, run: jest.fn() });
	const credentials = { get: jest.fn().mockReturnValue('saved-key'), set: jest.fn() };
	const settings = { runtime: 'codex', providerId: 'openai-codex', modelId: '', thinkingLevel: 'medium', toolMode: 'read-only' };
	const coder = new Coder({
		store: { get: () => settings } as never,
		projects: {} as never,
		credentials,
		sessions: {} as never,
	});
	await coder.listModels('codex');
	await coder.listModels('codex');
	expect(factory).toHaveBeenCalledTimes(1);
	const options = factory.mock.calls[0][0];
	expect(options).toMatchObject({
		name: 'Codex',
		provider: { id: 'openai-codex', authentication: 'oauth2' },
		harness: { binary: 'codex', instructionFiles: ['AGENTS.override.md', 'AGENTS.md'] },
	});
	expect(options.getApiKey()).toBe('saved-key');
	expect(credentials.get).toHaveBeenCalledWith('codex:openai');
	coder.setApiKey('openai', 'new-key', 'codex');
	expect(credentials.set).toHaveBeenCalledWith('codex:openai', 'new-key');
	expect(() => coder.setApiKey('other', 'new-key', 'codex')).toThrow('Invalid Coder provider');
	coder.destroy();
	expect(destroy).toHaveBeenCalledTimes(1);
});
