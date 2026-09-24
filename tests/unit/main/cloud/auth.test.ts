import { createClient } from '@supabase/supabase-js';
import { AuthService } from '../../../../src/main/cloud/service';
import { publicCloudError } from '../../../../src/main/cloud/cloud_error';
import { publicAuthError } from '../../../../src/main/cloud/error';
import type { AuthStorage } from '../../../../src/main/cloud/session';
import { SupabaseAccountProvider } from '../../../../src/main/cloud/supabase/auth';
import { createSupabaseClient } from '../../../../src/main/cloud/supabase/client';

jest.mock('@supabase/supabase-js', () => ({
	createClient: jest.fn(),
}));

const createClientMock = createClient as jest.Mock;
const unsubscribe = jest.fn();
const getSession = jest.fn(async () => ({ data: { session: null }, error: null }));
const onAuthStateChange = jest.fn(() => ({ data: { subscription: { unsubscribe } } }));
const exchangeCodeForSession = jest.fn();
const signInWithOAuth = jest.fn();
const stopAutoRefresh = jest.fn();
const from = jest.fn();
const config = {
	url: 'https://project.supabase.co',
	publishableKey: 'sb_publishable_test',
	redirectUrl: 'kucedr://auth/callback',
};
const binding = { accept: jest.fn(() => true), clear: jest.fn() };

function accountProvider(storage: AuthStorage): SupabaseAccountProvider {
	return new SupabaseAccountProvider(createSupabaseClient(config, storage), config, storage);
}

beforeEach(() => {
	createClientMock.mockReturnValue({
		from,
		auth: {
			exchangeCodeForSession,
			getSession,
			onAuthStateChange,
			signInWithOAuth,
			stopAutoRefresh,
		},
	});
});

it('reads and updates the signed-in account profile', async () => {
	getSession.mockResolvedValueOnce({
		data: {
			session: {
				access_token: 'access-secret',
				refresh_token: 'refresh-secret',
				user: { id: 'user-id', email: 'user@example.test', user_metadata: {} },
			},
		},
		error: null,
	});
	const getMaybeSingle = jest.fn(async () => ({
		data: { first_name: 'Ada', last_name: 'Byron' },
		error: null,
	}));
	const updateSingle = jest.fn(async () => ({
		data: { first_name: 'Grace', last_name: 'Hopper' },
		error: null,
	}));
	const getEq = jest.fn(() => ({ maybeSingle: getMaybeSingle }));
	const updateSelect = jest.fn(() => ({ single: updateSingle }));
	const updateEq = jest.fn(() => ({ select: updateSelect }));
	const update = jest.fn(() => ({ eq: updateEq }));
	const select = jest.fn(() => ({ eq: getEq }));
	from.mockReturnValue({ select, update });
	const service = new AuthService(
		accountProvider({
			persistence: 'encrypted',
			getItem: jest.fn(() => null),
			setItem: jest.fn(),
			removeItem: jest.fn(),
		}),
		binding
	);
	await service.initialize();

	await expect(service.getProfile()).resolves.toEqual({ firstName: 'Ada', lastName: 'Byron' });
	getMaybeSingle.mockResolvedValueOnce({ data: null, error: null } as never);
	await expect(service.getProfile()).resolves.toEqual({ firstName: '', lastName: '' });
	await expect(service.updateProfile({ firstName: 'Grace', lastName: 'Hopper' })).resolves.toEqual({
		firstName: 'Grace',
		lastName: 'Hopper',
	});
	expect(update).toHaveBeenCalledWith({ first_name: 'Grace', last_name: 'Hopper' });
	expect(getEq).toHaveBeenCalledWith('id', 'user-id');
	expect(updateEq).toHaveBeenCalledWith('id', 'user-id');
});

it('explains when the required profile table is missing', () => {
	expect(publicCloudError({ code: 'PGRST205' })).toMatchObject({
		name: 'CloudError',
		message: 'The cloud service is temporarily unavailable. Please try again later.',
	});
});

it('keeps provider error identifiers out of public authentication errors', () => {
	expect(publicAuthError({ code: 'invalid_credentials' })).toMatchObject({
		name: 'AuthError',
		message: 'The email or password is incorrect.',
	});
});

it('configures Supabase to restore sessions from encrypted main-process storage', async () => {
	const storage: AuthStorage = {
		persistence: 'encrypted',
		getItem: jest.fn(() => null),
		setItem: jest.fn(),
		removeItem: jest.fn(),
	};
	const service = new AuthService(accountProvider(storage), binding);

	await service.initialize();

	expect(createClientMock).toHaveBeenCalledWith(
		'https://project.supabase.co',
		'sb_publishable_test',
		expect.objectContaining({
			auth: expect.objectContaining({
				persistSession: true,
				storage,
			}),
		})
	);
	expect(service.getState()).toEqual({ status: 'signedOut', persistence: 'encrypted' });
});

it('restores a persisted session without exposing its tokens in public auth state', async () => {
	getSession.mockResolvedValueOnce({
		data: {
			session: {
				access_token: 'access-secret',
				refresh_token: 'refresh-secret',
				user: {
					id: 'user-id',
					email: 'user@example.test',
					user_metadata: {},
				},
			},
		},
		error: null,
	});
	const service = new AuthService(
		accountProvider({
			persistence: 'encrypted',
			getItem: jest.fn(() => null),
			setItem: jest.fn(),
			removeItem: jest.fn(),
		}),
		binding
	);

	await service.initialize();

	expect(service.getState()).toEqual({
		status: 'signedIn',
		persistence: 'encrypted',
		user: { id: 'user-id', email: 'user@example.test' },
	});
	expect(JSON.stringify(service.getState())).not.toMatch(/access-secret|refresh-secret/);
});

it('starts Google sign-in with a PKCE deep-link callback', async () => {
	const url = 'https://project.supabase.co/auth/v1/authorize?provider=google';
	signInWithOAuth.mockResolvedValueOnce({ data: { url }, error: null });
	const service = new AuthService(
		accountProvider({
			persistence: 'encrypted',
			getItem: jest.fn(() => null),
			setItem: jest.fn(),
			removeItem: jest.fn(),
		}),
		binding
	);

	await service.initialize();

	await expect(service.signInWithGoogle()).resolves.toBe(url);
	expect(signInWithOAuth).toHaveBeenCalledWith({
		provider: 'google',
		options: {
			redirectTo: 'kucedr://auth/callback',
			skipBrowserRedirect: true,
		},
	});

	signInWithOAuth.mockResolvedValueOnce({
		data: { url: 'https://malicious.example/auth/v1/authorize?provider=google' },
		error: null,
	});
	await expect(service.signInWithGoogle()).rejects.toThrow(
		'The account service returned an invalid sign-in URL.'
	);
});

it('exchanges a Google callback code for a token-free signed-in state', async () => {
	const session = {
		access_token: 'access-secret',
		refresh_token: 'refresh-secret',
		user: {
			id: 'google-user-id',
			email: 'user@gmail.com',
			user_metadata: {},
		},
	};
	exchangeCodeForSession.mockResolvedValueOnce({ data: { session }, error: null });
	const service = new AuthService(
		accountProvider({
			persistence: 'encrypted',
			getItem: jest.fn(() => null),
			setItem: jest.fn(),
			removeItem: jest.fn(),
		}),
		binding
	);

	await service.initialize();

	await expect(
		service.handleDeepLink('kucedr://auth/callback?code=google-authorization-code')
	).resolves.toEqual({
		status: 'signedIn',
		persistence: 'encrypted',
		user: { id: 'google-user-id', email: 'user@gmail.com' },
	});
	expect(exchangeCodeForSession).toHaveBeenCalledWith('google-authorization-code');
	expect(JSON.stringify(service.getState())).not.toMatch(/access-secret|refresh-secret/);
});
