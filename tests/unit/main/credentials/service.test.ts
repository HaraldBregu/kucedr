import type { AccountSession } from '../../../../src/main/cloud/account';
import { CredentialMigration } from '../../../../src/main/credentials/migration';
import { CredentialService } from '../../../../src/main/credentials/service';
import type { StoredProvider } from '../../../../src/shared/provider_types';

const PASSPHRASE = 'correct horse battery';
const SECRET = 'sk-test-secret-key-0123456789';

function setup(request: typeof fetch = jest.fn()) {
	const listeners = new Set<(session: AccountSession | null) => void>();
	const state = { userId: 'user-a' as string | undefined };
	const files = new Map<string, string>();
	const remembered = new Map<string, Buffer>();
	const auth = {
		getSignedInUserId: () => state.userId,
		onSessionChanged: (listener: (session: AccountSession | null) => void) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
	};
	const file = {
		read: jest.fn(async (userId: string) => files.get(userId) ?? null),
		write: jest.fn(async (userId: string, text: string) => void files.set(userId, text)),
	};
	const keys = {
		get: (userId: string) => remembered.get(userId),
		set: (userId: string, key: Buffer) => void remembered.set(userId, key),
		delete: (userId: string) => void remembered.delete(userId),
	};
	const make = () => new CredentialService(auth, file, keys, request);
	const switchTo = (userId: string | undefined) => {
		state.userId = userId;
		listeners.forEach((listener) =>
			listener(userId ? ({ user: { id: userId } } as AccountSession) : null)
		);
	};
	return { service: make(), make, files, file, remembered, switchTo, state };
}

it('creates the keys file on first unlock and stores only ciphertext', async () => {
	const { service, files } = setup();
	expect(await service.status()).toBe('empty');
	await service.unlock(PASSPHRASE);
	const created = await service.create({ service: 'openai', label: 'Work', secret: SECRET });

	expect(created).toEqual(expect.objectContaining({ service: 'openai', label: 'Work', lastFour: '6789' }));
	expect(created).not.toHaveProperty('secret');
	const stored = files.get('user-a') ?? '';
	expect(stored).not.toContain(SECRET);
	expect(stored).not.toContain('Work');
	expect(stored).not.toContain(PASSPHRASE);
	expect(service.provider('openai', created.id)).toEqual({
		id: 'openai',
		apiKey: SECRET,
		baseURL: 'https://api.openai.com/v1',
	});
});

it('rejects a wrong passphrase and a file copied to another account', async () => {
	const { service, make, files, switchTo } = setup();
	await service.unlock(PASSPHRASE);
	await service.create({ service: 'openai', label: 'Work', secret: SECRET });

	const other = make();
	await expect(other.unlock('wrong passphrase!')).rejects.toThrow('incorrect');
	expect(await other.status()).toBe('locked');

	files.set('user-b', files.get('user-a') ?? '');
	switchTo('user-b');
	await expect(other.unlock(PASSPHRASE)).rejects.toThrow('incorrect');
});

it('reopens with the key remembered on this device, forgets it on lock and on account switch', async () => {
	const { service, make, remembered, switchTo } = setup();
	await service.unlock(PASSPHRASE);
	const { id } = await service.create({ service: 'anthropic', label: 'Home', secret: SECRET });
	expect([...remembered.values()][0]).not.toContain(Buffer.from(PASSPHRASE));

	const restarted = make();
	restarted.initialize();
	await new Promise((resolve) => setTimeout(resolve, 0));
	expect(await restarted.status()).toBe('unlocked');
	expect(restarted.provider('anthropic', id).apiKey).toBe(SECRET);

	switchTo('user-b');
	expect(() => restarted.provider('anthropic', id)).toThrow('Unlock');
	switchTo('user-a');
	restarted.lock();
	expect(remembered.size).toBe(0);
	expect(() => restarted.provider('anthropic', id)).toThrow('Unlock');
});

it('picks up changes saved by another device before writing', async () => {
	const { service, make } = setup();
	await service.unlock(PASSPHRASE);
	const otherDevice = make();
	await otherDevice.unlock(PASSPHRASE);
	await otherDevice.create({ service: 'openai', label: 'From laptop', secret: SECRET });
	await service.create({ service: 'xai', label: 'From desktop', secret: `${SECRET}-x` });

	expect((await otherDevice.list()).map((entry) => entry.label)).toEqual(['From laptop', 'From desktop']);
});

it('tests a key against the provider without following redirects', async () => {
	const request = jest.fn(async () => new Response(null, { status: 401 }));
	const { service } = setup(request as unknown as typeof fetch);
	await service.unlock(PASSPHRASE);
	const { id } = await service.create({ service: 'openai', label: 'Work', secret: SECRET });

	expect(await service.test(id)).toBe(false);
	expect(request).toHaveBeenCalledWith(
		'https://api.openai.com/v1/models',
		expect.objectContaining({ headers: { authorization: `Bearer ${SECRET}` }, redirect: 'error' })
	);
});

it('uploads local keys once and removes the local copy only after it is in the keys file', async () => {
	const { service } = setup();
	await service.unlock(PASSPHRASE);
	let providers: StoredProvider[] = [
		{ id: 'openai', name: 'OpenAI', apiKey: SECRET, baseUrl: 'https://api.openai.com/v1' },
		{ id: 'custom', name: 'Custom', apiKey: 'custom-key-123', baseUrl: 'https://example.test' },
	];
	const migration = new CredentialMigration(service, {
		list: () => providers,
		remove: (id) => {
			providers = providers.filter((provider) => provider.id !== id);
		},
	});

	expect(migration.listLocal()).toEqual([
		{ localId: 'openai', service: 'openai', name: 'OpenAI', lastFour: '6789' },
	]);
	await expect(migration.removeLocal('openai')).rejects.toThrow('Upload');
	const [first] = await migration.migrate(['openai']);
	const [again] = await migration.migrate(['openai']);
	expect(again.credentialId).toBe(first.credentialId);
	expect(await service.list()).toHaveLength(1);

	expect(await migration.removeLocal('openai')).toBe(first.credentialId);
	expect(providers.map((provider) => provider.id)).toEqual(['custom']);
});
