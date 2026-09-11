import { AuthSessionStorage } from '../../../../src/main/cloud/session';

it('keeps Supabase sessions in memory only', () => {
	const storage = new AuthSessionStorage();

	storage.setItem('auth-token', 'access-secret');

	expect(storage.persistence).toBe('memory');
	expect(storage.getItem('auth-token')).toBe('access-secret');
	expect(new AuthSessionStorage().getItem('auth-token')).toBeNull();
});

it('removes sessions on sign-out', () => {
	const storage = new AuthSessionStorage();
	storage.setItem('auth-token', 'session');

	storage.removeItem('auth-token');

	expect(storage.getItem('auth-token')).toBeNull();
});
