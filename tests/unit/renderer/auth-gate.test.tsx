import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { AuthApi, AuthState } from '../../../src/shared/auth_types';
import { StartupGate } from '../../../src/renderer/src/auth/Gate';
import { AuthProvider, useAuth } from '../../../src/renderer/src/contexts/AuthContext';
import { OnboardingProvider } from '../../../src/renderer/src/contexts/OnboardingProvider';
import { useOnboarding } from '../../../src/renderer/src/contexts/useOnboarding';
import StartPage from '../../../src/renderer/src/pages/start/StartPage';

jest.mock('../../../src/renderer/src/components/app/base/logo-view', () => ({
	LogoView: () => <span aria-label="Kucedr" />,
}));

jest.mock('../../../src/renderer/src/pages/start/components/SetupProviderStep', () => ({
	SetupProviderStep: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

jest.mock('../../../src/renderer/src/pages/start/components/SetupModelsStep', () => ({
	SetupModelsStep: () => <h1>Agent configuration</h1>,
}));

function Location(): React.JSX.Element {
	const location = useLocation();
	return <output aria-label="Current route">{location.pathname}</output>;
}

function RefreshConfiguration(): React.JSX.Element {
	const { refreshConfiguration } = useOnboarding();
	return (
		<button type="button" onClick={() => void refreshConfiguration()}>
			Refresh configuration
		</button>
	);
}

function SkipAuthentication(): React.JSX.Element {
	const { skipSignIn } = useAuth();
	return (
		<button type="button" onClick={skipSignIn}>
			Skip
		</button>
	);
}

function authApi(initialState: AuthState, signedInState?: AuthState): AuthApi {
	let listener: ((next: AuthState) => void) | undefined;
	return {
		getState: jest.fn(async () => initialState),
		getProfile: jest.fn(async () => ({ firstName: '', lastName: '' })),
		updateProfile: jest.fn(async (profile) => profile),
		signIn: jest.fn(async () => {
			const next = signedInState ?? initialState;
			listener?.(next);
			return next;
		}),
		signInWithGoogle: jest.fn(),
		signUp: jest.fn(),
		resendConfirmation: jest.fn(),
		requestPasswordReset: jest.fn(),
		updatePassword: jest.fn(),
		signOut: jest.fn(async () => {
			const next: AuthState = { status: 'signedOut', persistence: initialState.persistence };
			listener?.(next);
			return next;
		}),
		onStateChanged: jest.fn((callback) => {
			listener = callback;
			return jest.fn();
		}),
	};
}

function renderFlow(path: string): ReturnType<typeof render> {
	return render(
		<AuthProvider>
			<OnboardingProvider>
				<MemoryRouter initialEntries={[path]}>
					<StartupGate>
						<Routes>
							<Route
								path="/start"
								element={
									<>
										<Location />
										<StartPage />
										<RefreshConfiguration />
										<SkipAuthentication />
									</>
								}
							/>
							<Route
								path="/home"
								element={
									<>
										<Location />
										<Link to="/settings/account">Account settings</Link>
									</>
								}
							/>
							<Route
								path="/settings/account"
								element={
									<>
										<Location />
										<button type="button" onClick={() => void window.auth.signOut()}>
											Sign out
										</button>
									</>
								}
							/>
							<Route path="*" element={<Location />} />
						</Routes>
					</StartupGate>
				</MemoryRouter>
			</OnboardingProvider>
		</AuthProvider>
	);
}

beforeEach(() => {
	localStorage.clear();
	sessionStorage.clear();
	window.agent = {
		getProvider: jest.fn(async () => undefined),
		getModelId: jest.fn(async () => ''),
	} as never;
});

it.each(['/auth', '/setup', '/config', '/home'])(
	'funnels %s through the single start page',
	async (path) => {
		window.auth = authApi({ status: 'signedOut', persistence: 'encrypted' });
		renderFlow(path);

		expect(await screen.findByRole('heading', { name: 'Kucedr' })).toBeInTheDocument();
		expect(screen.getByLabelText('Current route')).toHaveTextContent('/start');
	}
);

it.each(['/home', '/settings/account'])(
	'preserves %s when a configured signed-in session is refreshed',
	async (path) => {
		sessionStorage.setItem('kucedr-onboarding-started', 'true');
		window.auth = authApi({
			status: 'signedIn',
			persistence: 'encrypted',
			user: { id: 'user-id', email: 'user@example.test' },
		});
		window.agent = {
			getProvider: jest.fn(async () => ({ id: 'provider' }) as never),
			getModelId: jest.fn(async () => 'model'),
		} as never;
		renderFlow(path);

		await waitFor(() => expect(window.agent.getProvider).toHaveBeenCalled());
		expect(screen.getByLabelText('Current route')).toHaveTextContent(path);
		expect(screen.queryByRole('heading', { name: 'Kucedr' })).not.toBeInTheDocument();
	}
);

it.each(['/home', '/settings/account'])(
	'restores %s after an authenticated app restart',
	async (path) => {
		window.auth = authApi({
			status: 'signedIn',
			persistence: 'encrypted',
			user: { id: 'user-id', email: 'user@example.test' },
		});
		window.agent = {
			getProvider: jest.fn(async () => ({ id: 'provider' }) as never),
			getModelId: jest.fn(async () => 'model'),
		} as never;

		renderFlow(path);

		await waitFor(() => expect(window.agent.getProvider).toHaveBeenCalled());
		expect(screen.getByLabelText('Current route')).toHaveTextContent(path);
		expect(screen.queryByRole('heading', { name: 'Kucedr' })).not.toBeInTheDocument();
	}
);

it('preserves home when a skipped local-only session is refreshed', async () => {
	const user = userEvent.setup();
	window.auth = authApi({ status: 'signedOut', persistence: 'encrypted' });
	window.agent = {
		getProvider: jest.fn(async () => ({ id: 'provider' }) as never),
		getModelId: jest.fn(async () => 'model'),
	} as never;
	const firstRender = renderFlow('/start');

	await user.click(await screen.findByRole('button', { name: 'Get started' }));
	await user.click(await screen.findByRole('button', { name: 'Skip' }));
	await waitFor(() => expect(screen.getByLabelText('Current route')).toHaveTextContent('/home'));
	firstRender.unmount();

	renderFlow('/home');
	expect(await screen.findByLabelText('Current route')).toHaveTextContent('/home');
	expect(window.agent.getProvider.mock.calls.length).toBeGreaterThan(1);
	expect(screen.queryByRole('heading', { name: 'Kucedr' })).not.toBeInTheDocument();
});

it('moves from landing to auth without a back action or bottom navigation', async () => {
	const user = userEvent.setup();
	window.auth = authApi({ status: 'signedOut', persistence: 'encrypted' });
	renderFlow('/start');

	expect(document.querySelector('footer')).not.toBeInTheDocument();
	await user.click(await screen.findByRole('button', { name: 'Get started' }));
	expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
	expect(document.querySelector('footer')).not.toBeInTheDocument();
	expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
	expect(screen.getByLabelText('Current route')).toHaveTextContent('/start');
});

it('keeps the landing step disabled until the session resolves', async () => {
	let resolveState: ((state: AuthState) => void) | undefined;
	window.auth = {
		...authApi({ status: 'loading', persistence: 'memory' }),
		getState: jest.fn(
			() =>
				new Promise<AuthState>((resolve) => {
					resolveState = resolve;
				})
		),
	};
	renderFlow('/start');

	expect(screen.getByRole('button', { name: 'Checking your session…' })).toBeDisabled();
	expect(window.agent.getProvider).not.toHaveBeenCalled();
	resolveState?.({ status: 'signedOut', persistence: 'memory' });
	expect(await screen.findByRole('button', { name: 'Get started' })).toBeEnabled();
});

it('takes a restored configured signed-in user directly to home', async () => {
	window.auth = authApi({
		status: 'signedIn',
		persistence: 'encrypted',
		user: { id: 'user-id', email: 'user@example.test' },
	});
	window.agent = {
		getProvider: jest.fn(async () => ({ id: 'provider' }) as never),
		getModelId: jest.fn(async () => 'model'),
	} as never;
	renderFlow('/start');

	await waitFor(() => expect(screen.getByLabelText('Current route')).toHaveTextContent('/home'));
});

it('takes a restored unconfigured signed-in user directly to setup', async () => {
	window.auth = authApi({
		status: 'signedIn',
		persistence: 'memory',
		user: { id: 'user-id', email: 'user@example.test' },
	});
	renderFlow('/start');

	expect(await screen.findByRole('heading', { name: 'Model providers' })).toBeInTheDocument();
	expect(screen.getByText('Model').parentElement).toHaveTextContent('Model · 1 of 3');
	expect(screen.getByLabelText('Current route')).toHaveTextContent('/start');
});

it('takes skipped sign-in to home when configuration is complete', async () => {
	const user = userEvent.setup();
	window.auth = authApi({ status: 'signedOut', persistence: 'encrypted' });
	window.agent = {
		getProvider: jest.fn(async () => ({ id: 'provider' }) as never),
		getModelId: jest.fn(async () => 'model'),
	} as never;
	renderFlow('/start');

	await user.click(await screen.findByRole('button', { name: 'Get started' }));
	await user.click(await screen.findByRole('button', { name: 'Skip' }));
	await waitFor(() => expect(screen.getByLabelText('Current route')).toHaveTextContent('/home'));
});

it('takes skipped sign-in to setup in place when configuration is incomplete', async () => {
	const user = userEvent.setup();
	window.auth = authApi({ status: 'signedOut', persistence: 'encrypted' });
	renderFlow('/start');

	await user.click(await screen.findByRole('button', { name: 'Get started' }));
	await user.click(await screen.findByRole('button', { name: 'Skip' }));
	expect(await screen.findByRole('heading', { name: 'Model providers' })).toBeInTheDocument();
	expect(screen.getByLabelText('Current route')).toHaveTextContent('/start');
	expect(localStorage.getItem('kucedr-auth-local-only')).toBeNull();
});

it('keeps a configured user in the app after signing out', async () => {
	const user = userEvent.setup();
	const pendingSetupCheck = new Promise<never>(() => undefined);
	window.auth = authApi({
		status: 'signedIn',
		persistence: 'encrypted',
		user: { id: 'user-id', email: 'user@example.test' },
	});
	window.agent = {
		getProvider: jest
			.fn()
			.mockResolvedValueOnce({ id: 'provider' } as never)
			.mockReturnValue(pendingSetupCheck),
		getModelId: jest.fn().mockResolvedValueOnce('model').mockReturnValue(pendingSetupCheck),
	} as never;
	renderFlow('/start');

	await waitFor(() => expect(screen.getByLabelText('Current route')).toHaveTextContent('/home'));
	await user.click(screen.getByRole('link', { name: 'Account settings' }));
	expect(screen.getByLabelText('Current route')).toHaveTextContent('/settings/account');

	await user.click(screen.getByRole('button', { name: 'Sign out' }));
	await waitFor(() => expect(window.agent.getProvider).toHaveBeenCalledTimes(2));
	expect(screen.getByLabelText('Current route')).toHaveTextContent('/settings/account');
	expect(screen.queryByRole('heading', { name: 'Welcome back' })).not.toBeInTheDocument();
});

it('moves a successful sign-in to setup in place', async () => {
	const user = userEvent.setup();
	const signedIn: AuthState = {
		status: 'signedIn',
		persistence: 'encrypted',
		user: { id: 'user-id', email: 'user@example.test' },
	};
	window.auth = authApi({ status: 'signedOut', persistence: 'encrypted' }, signedIn);
	renderFlow('/start');

	await user.click(await screen.findByRole('button', { name: 'Get started' }));
	await user.type(screen.getByLabelText('Email'), 'user@example.test');
	await user.type(screen.getByLabelText('Password'), 'valid-password');
	await user.click(screen.getByRole('button', { name: 'Sign in' }));

	expect(await screen.findByRole('heading', { name: 'Model providers' })).toBeInTheDocument();
	expect(screen.getByLabelText('Current route')).toHaveTextContent('/start');
});

it('leaves setup for home after configuration is refreshed', async () => {
	const user = userEvent.setup();
	let configured = false;
	window.auth = authApi({
		status: 'signedIn',
		persistence: 'encrypted',
		user: { id: 'user-id', email: 'user@example.test' },
	});
	window.agent = {
		getProvider: jest.fn(async () => (configured ? ({ id: 'provider' } as never) : undefined)),
		getModelId: jest.fn(async () => (configured ? 'model' : '')),
	} as never;
	renderFlow('/start');

	expect(await screen.findByRole('heading', { name: 'Model providers' })).toBeInTheDocument();
	configured = true;
	await user.click(screen.getByRole('button', { name: 'Refresh configuration' }));
	await waitFor(() => expect(screen.getByLabelText('Current route')).toHaveTextContent('/home'));
});
