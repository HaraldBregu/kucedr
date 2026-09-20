import type {
	AccountProvider,
	AccountSession,
	AccountSessionEvent,
} from '../../../../src/main/cloud/account';
import { AuthService } from '../../../../src/main/cloud/service';

const staleSession: AccountSession = {
	accessToken: 'stale-secret',
	user: { id: 'stale-user', email: 'stale@example.test' },
};
const currentSession: AccountSession = {
	accessToken: 'current-secret',
	user: { id: 'current-user', email: 'current@example.test' },
};

function accountProvider(overrides: Partial<AccountProvider> = {}): AccountProvider {
	return {
		persistence: 'encrypted',
		subscribe: jest.fn(() => jest.fn()),
		restore: jest.fn(async () => null),
		getProfile: jest.fn(async () => ({ firstName: 'Ada', lastName: 'Byron' })),
		updateProfile: jest.fn(async (_userId, profile) => profile),
		signIn: jest.fn(async () => currentSession),
		signInWithGoogle: jest.fn(async () => 'https://accounts.example.test'),
		signUp: jest.fn(async () => currentSession),
		resendConfirmation: jest.fn(async () => undefined),
		requestPasswordReset: jest.fn(async () => undefined),
		updatePassword: jest.fn(async () => currentSession.user),
		signOut: jest.fn(async () => undefined),
		exchangeCode: jest.fn(async () => currentSession),
		destroy: jest.fn(),
		...overrides,
	};
}

it('does not let a delayed restore overwrite a newer provider session event', async () => {
	let emit!: (event: AccountSessionEvent, session: AccountSession | null) => void;
	let resolveRestore!: (session: AccountSession | null) => void;
	const provider = accountProvider({
		subscribe: jest.fn((listener) => {
			emit = listener;
			return jest.fn();
		}),
		restore: jest.fn(
			() =>
				new Promise<AccountSession | null>((resolve) => {
					resolveRestore = resolve;
				})
		),
	});
	const service = new AuthService(provider, { accept: () => true });

	const initializing = service.initialize();
	emit('session', currentSession);
	resolveRestore(staleSession);
	await initializing;

	expect(service.getState()).toEqual({
		status: 'signedIn',
		persistence: 'encrypted',
		user: currentSession.user,
	});
	expect(service.getAccessToken()).toBe('current-secret');
});

it('limits a recovery session to recovery operations', async () => {
	let emit!: (event: AccountSessionEvent, session: AccountSession | null) => void;
	const provider = accountProvider({
		subscribe: jest.fn((listener) => {
			emit = listener;
			return jest.fn();
		}),
	});
	const service = new AuthService(provider, { accept: () => true });
	await service.initialize();

	emit('recovery', currentSession);

	expect(service.getState()).toEqual({
		status: 'recovery',
		persistence: 'encrypted',
		user: currentSession.user,
	});
	expect(service.getAccessToken()).toBeNull();
	expect(service.getSignedInUserId()).toBeUndefined();
	await expect(service.getProfile()).rejects.toThrow('Sign in to manage your account.');
	await expect(
		service.updateProfile({ firstName: 'Grace', lastName: 'Hopper' })
	).rejects.toThrow('Sign in to manage your account.');
	expect(provider.getProfile).not.toHaveBeenCalled();
	expect(provider.updateProfile).not.toHaveBeenCalled();
});

it('notifies session listeners when a device account mismatch rejects a session', async () => {
	const provider = accountProvider({ restore: jest.fn(async () => currentSession) });
	const service = new AuthService(provider, { accept: () => false });
	const listener = jest.fn();
	service.onSessionChanged(listener);

	await service.initialize();

	expect(listener).toHaveBeenCalledWith(null);
	expect(service.getState()).toEqual({ status: 'signedOut', persistence: 'encrypted' });
});

it('keeps provider tokens out of public auth state', async () => {
	const service = new AuthService(
		accountProvider({ restore: jest.fn(async () => currentSession) }),
		{ accept: () => true }
	);

	await service.initialize();

	expect(service.getState()).toEqual({
		status: 'signedIn',
		persistence: 'encrypted',
		user: currentSession.user,
	});
	expect(JSON.stringify(service.getState())).not.toMatch(/current-secret|accessToken/);
});


it('publishes safe callback failures and clears them when Google sign-in retries', async () => {
	const provider = accountProvider({
		exchangeCode: jest.fn().mockRejectedValueOnce(new Error('provider-secret')).mockResolvedValue(currentSession),
	});
	const service = new AuthService(provider, { accept: () => true });
	await service.initialize();
	const listener = jest.fn();
	service.onStateChanged(listener);

	await expect(service.handleDeepLink('kucedr://auth/callback?code=expired')).rejects.toThrow(
		'Sign-in could not be completed. Please try again.'
	);
	expect(listener).toHaveBeenLastCalledWith({
		status: 'signedOut',
		persistence: 'encrypted',
		error: 'Sign-in could not be completed. Please try again.',
	});
	expect(JSON.stringify(service.getState())).not.toContain('provider-secret');

	await service.signInWithGoogle();
	expect(service.getState()).not.toHaveProperty('error');
	await service.handleDeepLink('kucedr://auth/callback?code=valid');
	expect(service.getState()).toEqual({
		status: 'signedIn',
		persistence: 'encrypted',
		user: currentSession.user,
	});
});
