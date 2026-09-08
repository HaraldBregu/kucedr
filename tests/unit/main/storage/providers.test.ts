import Store from 'electron-store';
import { StorageProviderStore } from '../../../../src/main/storage/providers/store';
import type { StorageProvidersState } from '../../../../src/main/storage/providers/types';
import type { StorageProviderInput } from '../../../../src/shared/storage_types';

jest.mock('../../../../src/main/shared/restrict_settings_file', () => ({
	restrictSettingsFile: jest.fn(),
}));

const input: StorageProviderInput = {
	name: 'Archive',
	endpoint: 'https://storage.example.test',
	region: 'auto',
	bucket: 'archive',
	accessKeyId: 'access-key',
	secretAccessKey: 'secret-key',
	forcePathStyle: false,
};
const encryption = {
	isEncryptionAvailable: jest.fn(),
	getSelectedStorageBackend: jest.fn(),
	encryptString: jest.fn(),
	decryptString: jest.fn(),
};
let persistence: Store<StorageProvidersState>;
let providers: StorageProviderStore;

beforeEach(() => {
	jest.clearAllMocks();
	persistence = new Store<StorageProvidersState>({ defaults: { encryptedProviders: '' } });
	encryption.isEncryptionAvailable.mockReturnValue(true);
	encryption.getSelectedStorageBackend.mockReturnValue('gnome_libsecret');
	encryption.encryptString.mockImplementation((value: string) => Buffer.from(value));
	encryption.decryptString.mockImplementation((value: Buffer) => value.toString());
	providers = new StorageProviderStore(persistence, encryption, 'linux');
});

it('stores multiple connections independently and preserves them across store instances', () => {
	const first = providers.save(input);
	const second = providers.save({ ...input, bucket: 'another-bucket' });
	expect(first.id).not.toBe(second.id);
	expect(new StorageProviderStore(persistence, encryption).list()).toEqual([first, second]);
	expect(providers.remove(first.id)).toBe(true);
	expect(providers.list()).toEqual([second]);
	expect(providers.remove(first.id)).toBe(false);
});

it('encrypts metadata and secrets and excludes the saved secret from public results', () => {
	const saved = providers.save(input);
	expect(saved).not.toHaveProperty('secretAccessKey');
	expect(saved.hasSecretAccessKey).toBe(true);
	expect(providers.list()[0]).not.toHaveProperty('secretAccessKey');
	expect(JSON.parse(encryption.encryptString.mock.calls[0][0])).toEqual([{ ...input, id: saved.id }]);
	const persisted = JSON.stringify(persistence.store);
	for (const value of [input.name, input.endpoint, input.accessKeyId, input.secretAccessKey!]) {
		expect(persisted).not.toContain(value);
	}
});

it.each(['', '   ', undefined])(
	'preserves the existing secret when editing with %p',
	(secretAccessKey) => {
		const saved = providers.save(input);
		const updated = providers.save({ ...input, id: saved.id, name: 'Renamed', secretAccessKey });
		expect(updated.name).toBe('Renamed');
		expect(providers.list()).toHaveLength(1);
		const decrypted = JSON.parse(
			Buffer.from(persistence.get('encryptedProviders'), 'base64').toString()
		);
		expect(decrypted[0].secretAccessKey).toBe(input.secretAccessKey);
	}
);

it('replaces the secret when a new value is provided', () => {
	const saved = providers.save(input);
	providers.save({ ...input, id: saved.id, secretAccessKey: 'replacement' });
	const decrypted = JSON.parse(
		Buffer.from(persistence.get('encryptedProviders'), 'base64').toString()
	);
	expect(decrypted[0].secretAccessKey).toBe('replacement');
});

it('accepts AWS default endpoints and HTTP endpoints for compatible providers', () => {
	expect(providers.save({ ...input, endpoint: '', region: 'us-east-1' }).endpoint).toBe('');
	expect(
		providers.save({ ...input, endpoint: 'http://localhost:9000', forcePathStyle: true })
			.forcePathStyle
	).toBe(true);
});

it.each([
	'ftp://storage.example.test',
	'https://user:password@storage.example.test',
	'https://storage.example.test?key=secret',
	'https://storage.example.test#fragment',
	'https://storage.example.test?',
	'https://storage.example.test#',
	'not-a-url',
])('rejects invalid endpoint %s before persisting', (endpoint) => {
	expect(() => providers.save({ ...input, endpoint })).toThrow('Storage endpoint');
	expect(persistence.get('encryptedProviders')).toBe('');
});

it.each(['name', 'region', 'bucket', 'accessKeyId', 'secretAccessKey'])(
	'requires %s on new connections',
	(field) => {
		expect(() => providers.save({ ...input, [field]: '  ' })).toThrow('required');
		expect(persistence.get('encryptedProviders')).toBe('');
	}
);

it.each([
	null,
	[],
	{ ...input, name: 1 },
	{ ...input, forcePathStyle: 'true' },
	{ ...input, secretAccessKey: {} },
	{ ...input, secretAccessKey: 'a'.repeat(16_385) },
	{ ...input, id: '../outside' },
])('validates untrusted IPC input %p', (value) => {
	expect(() => providers.save(value)).toThrow();
	expect(persistence.get('encryptedProviders')).toBe('');
});

it('rejects updates to nonexistent connections and invalid remove identifiers', () => {
	expect(() => providers.save({ ...input, id: 'a00c674a-c8c8-4d01-930f-ad690b3d0123' })).toThrow(
		'not found'
	);
	expect(() => providers.remove('../outside')).toThrow('identifier');
	expect(persistence.get('encryptedProviders')).toBe('');
});

it('refuses plaintext fallback when operating-system encryption is unavailable', () => {
	const saved = providers.save(input);
	const encrypted = persistence.get('encryptedProviders');
	encryption.isEncryptionAvailable.mockReturnValue(false);
	expect(() => providers.save(input)).toThrow('Secure operating-system storage is unavailable');
	expect(() => providers.list()).toThrow('Secure operating-system storage is unavailable');
	expect(() => providers.remove(saved.id)).toThrow(
		'Secure operating-system storage is unavailable'
	);
	expect(persistence.get('encryptedProviders')).toBe(encrypted);
});

it('rejects the insecure Linux basic_text backend', () => {
	encryption.getSelectedStorageBackend.mockReturnValue('basic_text');
	expect(() => providers.save(input)).toThrow('Secure operating-system storage is unavailable');
	expect(persistence.get('encryptedProviders')).toBe('');
});

it('preserves encrypted records when decryption fails', () => {
	providers.save(input);
	const encrypted = persistence.get('encryptedProviders');
	encryption.decryptString.mockImplementation(() => {
		throw new Error('Keychain failure');
	});
	expect(() => providers.save(input)).toThrow('Saved storage providers could not be opened');
	expect(persistence.get('encryptedProviders')).toBe(encrypted);
});

it('does not overwrite records if encrypting an edit fails', () => {
	const saved = providers.save(input);
	const encrypted = persistence.get('encryptedProviders');
	encryption.encryptString.mockImplementation(() => {
		throw new Error('Keychain failure');
	});
	expect(() => providers.save({ ...input, id: saved.id, name: 'Changed' })).toThrow(
		'Keychain failure'
	);
	expect(persistence.get('encryptedProviders')).toBe(encrypted);
});
