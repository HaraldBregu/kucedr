import { createCipheriv, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { safeStorage } from 'electron';

const root = '/tmp/kucedr-providers-store-test';

jest.mock('../../../../src/main/shared/user_data_location', () => ({
	userDataLocation: () => root,
}));

beforeEach(() => {
	rmSync(root, { recursive: true, force: true });
	mkdirSync(`${root}/settings`, { recursive: true });
	writeFileSync(`${root}/settings/providers.json`, '{}');
	jest.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(true);
	jest.mocked(safeStorage.decryptString).mockImplementation((value) => value.toString());
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

it('migrates decryptable provider keys into the direct settings store', () => {
	const key = randomBytes(32);
	const vaultId = 'legacy-vault';
	const nonce = randomBytes(12);
	const cipher = createCipheriv('aes-256-gcm', key, nonce);
	cipher.setAAD(Buffer.from(JSON.stringify([vaultId, 'models', 'openai', 1]), 'utf8'));
	const ciphertext = Buffer.concat([
		cipher.update(JSON.stringify({ name: 'OpenAI', apiKey: 'saved-key', baseUrl: 'https://api.openai.com/v1' })),
		cipher.final(),
	]);
	writeFileSync(
		`${root}/settings/provider-vault.json`,
		JSON.stringify({
			protectedKey: Buffer.from(key.toString('base64')).toString('base64'),
			records: {
				'models:openai': {
					vaultId,
					kind: 'models',
					providerId: 'openai',
					schemaVersion: 1,
					ciphertext: ciphertext.toString('base64'),
					nonce: nonce.toString('base64'),
					tag: cipher.getAuthTag().toString('base64'),
				},
			},
		})
	);

	let getModelProvidersState!: typeof import('../../../../src/main/providers/providers_store').getModelProvidersState;
	jest.isolateModules(() => {
		({ getModelProvidersState } = require('../../../../src/main/providers/providers_store'));
	});

	expect(getModelProvidersState()).toEqual([
		{ id: 'openai', name: 'OpenAI', apiKey: 'saved-key', baseUrl: 'https://api.openai.com/v1' },
	]);
	expect(existsSync(`${root}/settings/provider-vault.json`)).toBe(false);
});
