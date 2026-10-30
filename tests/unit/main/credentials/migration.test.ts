import Store from 'electron-store';
import { CredentialMigration } from '../../../../src/main/credentials/migration';
import type { CredentialService } from '../../../../src/main/credentials/service';
import type { StoredProvider } from '../../../../src/shared/provider_types';

const SECRET = 'sk-local-secret-key-1234';

function setup(userId: string | undefined = 'user-a') {
	const state = { userId };
	let providers: StoredProvider[] = [
		{ id: 'openai', name: 'OpenAI', apiKey: SECRET, baseUrl: 'https://api.openai.com/v1' },
		{ id: 'custom', name: 'Custom', apiKey: 'custom-key-123', baseUrl: 'https://example.test' },
	];
	const uploaded: { id: string }[] = [];
	const credentials = {
		create: jest.fn(async (_input: unknown, requestId?: string) => {
			const id = `cred-${requestId}`;
			if (!uploaded.some((entry) => entry.id === id)) uploaded.push({ id });
			return { id };
		}),
		list: jest.fn(async () => uploaded),
	};
	const local = {
		list: () => providers,
		remove: jest.fn((id: string) => {
			providers = providers.filter((provider) => provider.id !== id);
		}),
	};
	const migration = new CredentialMigration(
		credentials as unknown as CredentialService,
		() => state.userId,
		local,
		new Store({ defaults: { records: {} } }) as never
	);
	return { state, credentials, local, migration, uploaded, providers: () => providers };
}

it('lists only supported local keys and never exposes the full key', () => {
	const { migration } = setup();
	const listed = migration.listLocal();
	expect(listed).toEqual([{ localId: 'openai', service: 'openai', name: 'OpenAI', lastFour: '1234' }]);
	expect(JSON.stringify(listed)).not.toContain(SECRET);
});

it('requires a signed-in account to upload or remove', async () => {
	const { migration, credentials } = setup(undefined);
	await expect(migration.migrate(['openai'])).rejects.toThrow('Sign in');
	await expect(migration.removeLocal('openai')).rejects.toThrow('Sign in');
	expect(credentials.create).not.toHaveBeenCalled();
});

it('keeps the local key when upload fails and retries with the same request id', async () => {
	const { migration, credentials, local } = setup();
	credentials.create.mockRejectedValueOnce(new Error('network'));
	expect(await migration.migrate(['openai'])).toEqual([{ localId: 'openai', error: 'network' }]);
	expect(local.remove).not.toHaveBeenCalled();

	const [retry] = await migration.migrate(['openai']);
	const [again] = await migration.migrate(['openai']);
	const ids = credentials.create.mock.calls.map((call) => call[1]);
	expect(new Set(ids).size).toBe(1);
	expect(retry.credentialId).toBe(again.credentialId);
	expect(local.remove).not.toHaveBeenCalled();
});

it('removes the local copy only after the upload is verified for the same account', async () => {
	const { migration, local, state, uploaded } = setup();
	await expect(migration.removeLocal('openai')).rejects.toThrow('Upload this API key');
	const [result] = await migration.migrate(['openai']);

	state.userId = 'user-b';
	expect(migration.listLocal()[0]).not.toHaveProperty('uploadedCredentialId');
	await expect(migration.removeLocal('openai')).rejects.toThrow('Upload this API key');

	state.userId = 'user-a';
	uploaded.length = 0;
	await expect(migration.removeLocal('openai')).rejects.toThrow('could not be verified');
	expect(local.remove).not.toHaveBeenCalled();

	uploaded.push({ id: result.credentialId! });
	await expect(migration.removeLocal('openai')).resolves.toBe(result.credentialId);
	expect(local.remove).toHaveBeenCalledWith('openai');
});

it('uses a new request id when the local key changes', async () => {
	const { migration, credentials, providers } = setup();
	await migration.migrate(['openai']);
	providers()[0].apiKey = 'sk-rotated-secret-key-9999';
	await migration.migrate(['openai']);
	expect(credentials.create.mock.calls[0][1]).not.toBe(credentials.create.mock.calls[1][1]);
});
