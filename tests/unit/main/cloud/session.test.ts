import Store from 'electron-store';
import { safeStorage } from 'electron';
import { AuthSessionStorage } from '../../../../src/main/cloud/session';

const encryptionAvailable = safeStorage.isEncryptionAvailable as jest.Mock;
const selectedBackend = safeStorage.getSelectedStorageBackend as jest.Mock;
const encrypt = safeStorage.encryptString as jest.Mock;
const decrypt = safeStorage.decryptString as jest.Mock;

beforeEach(() => {
	encryptionAvailable.mockReturnValue(true);
	selectedBackend.mockReturnValue('gnome_libsecret');
	encrypt.mockImplementation((value: string) => Buffer.from(`sealed:${value}`, 'utf8'));
	decrypt.mockImplementation((value: Buffer) => value.toString('utf8').replace(/^sealed:/, ''));
});

it('stores encrypted Supabase sessions in the account store', () => {
	const store = new Store<{ values: Record<string, string> }>({ defaults: { values: {} } });
	const session = JSON.stringify({
		access_token: 'access-secret',
		refresh_token: 'refresh-secret',
	});
	new AuthSessionStorage(store).setItem('auth-token', session);

	expect(JSON.stringify(store.store)).not.toContain('access-secret');
	expect(JSON.stringify(store.store)).not.toContain('refresh-secret');
	expect(new AuthSessionStorage(store).getItem('auth-token')).toBe(session);
});

it('keeps the session memory-only when OS encryption is unavailable', () => {
	encryptionAvailable.mockReturnValue(false);
	const store = new Store<{ values: Record<string, string> }>({ defaults: { values: {} } });
	const storage = new AuthSessionStorage(store);

	storage.setItem('auth-token', 'access-secret');

	expect(storage.persistence).toBe('memory');
	expect(storage.getItem('auth-token')).toBe('access-secret');
	expect(store.get('values')).toEqual({});
	expect(new AuthSessionStorage(store).getItem('auth-token')).toBeNull();
});

it('restores persisted sessions once Electron encryption becomes available', () => {
	const store = new Store<{ values: Record<string, string> }>({ defaults: { values: {} } });
	const session = 'saved-session';
	new AuthSessionStorage(store).setItem('auth-token', session);
	const storage = new AuthSessionStorage(store);
	encryptionAvailable.mockReturnValue(false);

	expect(storage.getItem('auth-token')).toBeNull();
	expect(storage.persistence).toBe('memory');
	encryptionAvailable.mockReturnValue(true);
	expect(storage.getItem('auth-token')).toBe(session);
	expect(storage.persistence).toBe('encrypted');
});

it('removes persisted sessions on sign-out', () => {
	const store = new Store<{ values: Record<string, string> }>({ defaults: { values: {} } });
	const storage = new AuthSessionStorage(store);
	storage.setItem('auth-token', 'session');

	storage.removeItem('auth-token');

	expect(new AuthSessionStorage(store).getItem('auth-token')).toBeNull();
});
