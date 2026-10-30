import Store from 'electron-store';
import { credentialRegistry } from '../../../../src/main/credentials/registry';
import { CredentialSelection } from '../../../../src/main/credentials/selection';
import type { CredentialService } from '../../../../src/main/credentials/service';
import { getResolvedProvider } from '../../../../src/main/settings_store';

const KEY = '11111111-2222-4333-8444-555555555555';

function selection(state: { userId?: string }) {
	return new CredentialSelection(() => state.userId, new Store({ defaults: { users: {} } }) as never);
}

afterEach(() => {
	credentialRegistry.service = undefined;
	credentialRegistry.selection = undefined;
});

it('keeps one active key per plugin, scoped to the signed-in account', () => {
	const state: { userId?: string } = { userId: 'user-a' };
	const active = selection(state);
	active.set('openai', KEY);
	active.set('anthropic', '22222222-2222-4333-8444-555555555555');
	expect(active.get('openai')).toBe(KEY);

	state.userId = 'user-b';
	expect(active.all()).toEqual({});
	state.userId = undefined;
	expect(active.get('openai')).toBeUndefined();
	expect(() => active.set('openai', KEY)).toThrow('Sign in');

	state.userId = 'user-a';
	active.clear(KEY);
	expect(active.all()).toEqual({ anthropic: '22222222-2222-4333-8444-555555555555' });
});

it('resolves a plugin with its active cloud key', () => {
	const state: { userId?: string } = { userId: 'user-a' };
	const active = selection(state);
	const cloud = { id: 'openai', apiKey: 'sk-cloud', baseURL: 'https://api.openai.com/v1' };
	const provider = jest.fn(() => cloud);
	credentialRegistry.selection = active;
	credentialRegistry.service = { provider } as unknown as CredentialService;

	active.set('openai', KEY);
	expect(getResolvedProvider('openai')).toBe(cloud);
	expect(provider).toHaveBeenCalledWith('openai', KEY, undefined);

	state.userId = undefined;
	provider.mockClear();
	getResolvedProvider('openai');
	expect(provider).not.toHaveBeenCalled();
});
