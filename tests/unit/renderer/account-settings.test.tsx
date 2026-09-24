import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AuthApi, AuthState } from '../../../src/shared/auth_types';
import { AuthProvider } from '../../../src/renderer/src/contexts/AuthContext';
import AccountPage from '../../../src/renderer/src/pages/settings/pages/account/Page';

jest.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string): string => key }),
}));

jest.mock('@/contexts', () => ({
	useApp: () => ({ theme: 'light' }),
}));

jest.mock('@thilakbhat/heatmap-ui', () => ({
	CalendarHeatmap: ({ values, weeks, cellSize, to, shape, scale, colors, cellLabel, 'data-heatmap-theme': theme }: {
		values: { date: string; value: number }[];
		weeks: number;
		cellSize: number;
		to: string;
		shape: string;
		scale: string;
		colors: string[];
		cellLabel: (day: { date: string; value: number }) => string;
		'data-heatmap-theme'?: string;
	}) => (
		<div data-testid="activity-heatmap" data-count={values.length} data-weeks={weeks}
			data-cell-size={cellSize} data-to={to} data-shape={shape} data-scale={scale}
			data-colors={colors.join(',')} data-heatmap-theme={theme}>
			{values.map((day) => <div key={day.date} className="heatmap__cell-slot" role="img" aria-label={cellLabel(day)} />)}
		</div>
	),
}));

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
	Object.defineProperty(window, 'app', {
		configurable: true,
		value: { getActivity: jest.fn().mockResolvedValue([{ date: '2026-09-23', value: 12 }]) },
	});
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
	expect(await screen.findByText('Ada Byron')).toBeInTheDocument();
	expect(screen.getByText('user-id')).toBeInTheDocument();
	await waitFor(() => expect(screen.getByTestId('activity-heatmap')).toHaveAttribute('data-count', '1'));
	expect(screen.getByText('settings.activity.title')).toBeInTheDocument();
	expect(screen.getByText('settings.activity.description')).toBeInTheDocument();
	expect(screen.getByTestId('activity-scroll')).toHaveClass('card-body');
	expect(screen.getByTestId('activity-heatmap')).toHaveAttribute('data-weeks', '41');
	expect(screen.getByTestId('activity-heatmap')).toHaveAttribute('data-cell-size', '12');
	expect(screen.getByTestId('activity-heatmap')).toHaveAttribute('data-scale', 'linear');
	expect(screen.getByTestId('activity-heatmap')).toHaveAttribute('data-heatmap-theme', 'light');
	const cell = screen.getByRole('img', { name: 'settings.activity.day' });
	fireEvent.pointerMove(cell, { clientX: 160, clientY: 120 });
	expect(screen.getByRole('tooltip')).toHaveClass('fixed');
	expect(auth.updateProfile).not.toHaveBeenCalled();
	expect(container.querySelector('header svg')).toBeNull();
	await user.click(screen.getByRole('button', { name: 'Sign out' }));

	expect(confirmSignOut).toHaveBeenCalledTimes(1);
	await waitFor(() => expect(auth.signOut).toHaveBeenCalledTimes(1));
	expect(await screen.findByRole('button', { name: 'Login' })).toBeInTheDocument();
	expect(screen.queryByText('Identity')).not.toBeInTheDocument();
	expect(screen.queryByText('Session')).not.toBeInTheDocument();
	expect(screen.queryByText('user@example.test')).not.toBeInTheDocument();
	expect(screen.getByText('settings.activity.title')).toBeInTheDocument();
	expect(window.sessionStorage.getItem('kucedr-auth-local-only')).toBe('true');
	await user.click(screen.getByRole('button', { name: 'Login' }));
	expect(window.sessionStorage.getItem('kucedr-auth-local-only')).toBeNull();
});
