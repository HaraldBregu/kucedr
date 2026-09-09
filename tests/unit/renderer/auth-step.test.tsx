import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AuthApi, AuthState } from '../../../src/shared/auth_types';
import { AuthProvider } from '../../../src/renderer/src/contexts/AuthContext';
import { AuthStep } from '../../../src/renderer/src/pages/start/components/AuthStep';

function authApi(state: AuthState): AuthApi {
	let listener: ((next: AuthState) => void) | undefined;
	return {
		getState: jest.fn(async () => state),
		getProfile: jest.fn(async () => ({ firstName: '', lastName: '' })),
		updateProfile: jest.fn(async (profile) => profile),
		signIn: jest.fn(async () => state),
		signInWithGoogle: jest.fn(async () => undefined),
		signUp: jest.fn(async (input) => {
			const next: AuthState = {
				status: 'confirmationRequired',
				email: input.email,
				persistence: 'encrypted',
			};
			listener?.(next);
			return next;
		}),
		resendConfirmation: jest.fn(async () => undefined),
		requestPasswordReset: jest.fn(async () => undefined),
		updatePassword: jest.fn(async () => state),
		signOut: jest.fn(async () => state),
		onStateChanged: jest.fn((callback) => {
			listener = callback;
			return jest.fn();
		}),
	};
}

beforeEach(() => {
	window.auth = authApi({ status: 'signedOut', persistence: 'encrypted' });
});

it('submits email and password to sign in', async () => {
	const user = userEvent.setup();
	render(
		<AuthProvider>
			<AuthStep />
		</AuthProvider>
	);
	await user.type(screen.getByLabelText('Email'), 'user@example.test');
	await user.type(screen.getByLabelText('Password'), 'valid-password');
	await user.click(screen.getByRole('button', { name: 'Sign in' }));
	await waitFor(() =>
		expect(window.auth.signIn).toHaveBeenCalledWith({
			email: 'user@example.test',
			password: 'valid-password',
		})
	);
});

it('accepts a non-empty current password shorter than the new-password minimum', async () => {
	const user = userEvent.setup();
	render(
		<AuthProvider>
			<AuthStep />
		</AuthProvider>
	);
	await user.type(screen.getByLabelText('Email'), 'user@example.test');
	await user.type(screen.getByLabelText('Password'), 'short');
	await user.click(screen.getByRole('button', { name: 'Sign in' }));

	await waitFor(() =>
		expect(window.auth.signIn).toHaveBeenCalledWith({
			email: 'user@example.test',
			password: 'short',
		})
	);
});

it('keeps the eight-character minimum for new passwords', async () => {
	const user = userEvent.setup();
	const view = render(
		<AuthProvider>
			<AuthStep />
		</AuthProvider>
	);
	await user.click(screen.getByRole('button', { name: 'Create an account' }));

	expect(screen.getByLabelText('Password')).toHaveAttribute('minlength', '8');
	expect(screen.getByLabelText('Confirm password')).toHaveAttribute('minlength', '8');

	view.unmount();
	window.auth = authApi({ status: 'recovery', persistence: 'encrypted' });
	render(
		<AuthProvider>
			<AuthStep />
		</AuthProvider>
	);

	expect(await screen.findByLabelText('New password')).toHaveAttribute('minlength', '8');
	expect(screen.getByLabelText('Confirm password')).toHaveAttribute('minlength', '8');
});

it('starts Google sign-in', async () => {
	const user = userEvent.setup();
	render(
		<AuthProvider>
			<AuthStep />
		</AuthProvider>
	);

	await user.click(screen.getByRole('button', { name: 'Sign in with Google' }));

	expect(window.auth.signInWithGoogle).toHaveBeenCalledTimes(1);
});

it('creates an account and shows the confirmation state', async () => {
	const user = userEvent.setup();
	render(
		<AuthProvider>
			<AuthStep />
		</AuthProvider>
	);
	await user.click(screen.getByRole('button', { name: 'Create an account' }));
	await user.type(screen.getByLabelText('Email'), 'new@example.test');
	await user.type(screen.getByLabelText('Password'), 'valid-password');
	await user.type(screen.getByLabelText('Confirm password'), 'valid-password');
	await user.click(screen.getByRole('button', { name: 'Create account' }));
	await waitFor(() =>
		expect(screen.getByRole('heading', { name: 'Check your email' })).toBeInTheDocument()
	);
	expect(window.auth.signUp).toHaveBeenCalledWith({
		email: 'new@example.test',
		password: 'valid-password',
	});
});

it('keeps local-only continuation out of the account content', async () => {
	render(
		<AuthProvider>
			<AuthStep />
		</AuthProvider>
	);

	expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
	expect(screen.queryByRole('button', { name: 'Skip for now' })).not.toBeInTheDocument();
	expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
});

it('describes unavailable account services without exposing infrastructure configuration', async () => {
	window.auth = authApi({ status: 'unconfigured', persistence: 'memory' });
	render(
		<AuthProvider>
			<AuthStep />
		</AuthProvider>
	);

	expect(
		await screen.findByRole('heading', { name: 'Kucedr account services are unavailable' })
	).toBeInTheDocument();
	expect(screen.getByText(/continue using Kucedr on this device/i)).toBeInTheDocument();
	expect(screen.queryByText(/supabase|publishable_key|supabase_url/i)).not.toBeInTheDocument();
});

it('does not let a stale initial snapshot overwrite a newer auth event', async () => {
	let resolveState: ((state: AuthState) => void) | undefined;
	let listener: ((state: AuthState) => void) | undefined;
	window.auth = {
		...authApi({ status: 'signedOut', persistence: 'encrypted' }),
		getState: jest.fn(
			() =>
				new Promise<AuthState>((resolve) => {
					resolveState = resolve;
				})
		),
		onStateChanged: jest.fn((callback) => {
			listener = callback;
			return jest.fn();
		}),
	};
	render(
		<AuthProvider>
			<AuthStep />
		</AuthProvider>
	);

	act(() => {
		listener?.({
			status: 'confirmationRequired',
			email: 'user@example.test',
			persistence: 'encrypted',
		});
	});
	expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument();

	await act(async () => {
		resolveState?.({ status: 'signedOut', persistence: 'encrypted' });
	});
	expect(screen.getByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
});

it('does not let a stale initial failure overwrite a newer auth event', async () => {
	let rejectState: ((cause: Error) => void) | undefined;
	let listener: ((state: AuthState) => void) | undefined;
	window.auth = {
		...authApi({ status: 'signedOut', persistence: 'encrypted' }),
		getState: jest.fn(
			() =>
				new Promise<AuthState>((_resolve, reject) => {
					rejectState = reject;
				})
		),
		onStateChanged: jest.fn((callback) => {
			listener = callback;
			return jest.fn();
		}),
	};
	render(
		<AuthProvider>
			<AuthStep />
		</AuthProvider>
	);

	act(() => {
		listener?.({
			status: 'confirmationRequired',
			email: 'user@example.test',
			persistence: 'encrypted',
		});
	});
	expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument();

	await act(async () => {
		rejectState?.(new Error('Initial state failed'));
	});
	expect(screen.getByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
});
