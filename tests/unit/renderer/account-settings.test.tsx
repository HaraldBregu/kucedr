import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AuthApi, AuthState } from '../../../src/shared/auth_types';
import { AuthProvider } from '../../../src/renderer/src/contexts/AuthContext';
import AccountPage from '../../../src/renderer/src/pages/settings/pages/account/Page';

it('shows account session data and switches to local use after sign-out', async () => {
	const user = userEvent.setup();
	const signedIn: AuthState = {
		status: 'signedIn',
		persistence: 'encrypted',
		user: { id: 'user-id', email: 'user@example.test' },
	};
	const signedOut: AuthState = { status: 'signedOut', persistence: 'encrypted' };
	let listener: ((state: AuthState) => void) | undefined;
	const auth: AuthApi = {
		getState: jest.fn(async () => signedIn),
		getProfile: jest.fn(async () => ({ firstName: 'Ada', lastName: 'Byron' })),
		updateProfile: jest.fn(async (profile) => profile),
		signIn: jest.fn(),
		signInWithGoogle: jest.fn(),
		signUp: jest.fn(),
		resendConfirmation: jest.fn(),
		requestPasswordReset: jest.fn(),
		updatePassword: jest.fn(),
		signOut: jest.fn(async () => {
			listener?.(signedOut);
			return signedOut;
		}),
		onStateChanged: jest.fn((callback) => {
			listener = callback;
			return jest.fn();
		}),
	};
	window.auth = auth;
	const confirmSignOut = jest.fn(async () => true);
	Object.defineProperty(window, 'win', {
		configurable: true,
		value: { confirmSignOut },
	});

	const { container } = render(
		<AuthProvider>
			<AccountPage />
		</AuthProvider>
	);

	expect(await screen.findByText('user@example.test')).toBeInTheDocument();
	expect(screen.queryByLabelText('First name')).not.toBeInTheDocument();
	expect(screen.queryByLabelText('Last name')).not.toBeInTheDocument();
	expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
	expect(auth.getProfile).not.toHaveBeenCalled();
	expect(auth.updateProfile).not.toHaveBeenCalled();
	expect(container.querySelector('header svg')).toBeNull();
	await user.click(screen.getByRole('button', { name: 'Sign out' }));

	expect(confirmSignOut).toHaveBeenCalledTimes(1);
	await waitFor(() => expect(auth.signOut).toHaveBeenCalledTimes(1));
	expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
	expect(screen.getByText('Not signed in')).toBeInTheDocument();
});
