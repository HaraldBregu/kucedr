import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AuthApi, AuthState } from '../../../src/shared/auth_types';
import { AuthProvider } from '../../../src/renderer/src/contexts/AuthContext';
import AccountPage from '../../../src/renderer/src/pages/settings/pages/account/Page';

jest.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string, options?: { year?: number }): string => options?.year ? `${key} (${options.year})` : key }),
}));

jest.mock('@/contexts', () => ({
	useApp: () => ({ theme: 'light' }),
}));

jest.mock('@/components/ui/select', () => ({
	Select: ({ value, onValueChange, children }: { value: string; onValueChange: (value: string) => void; children: React.ReactNode }) => (
		<select aria-label="settings.activity.range" value={value} onChange={(event) => onValueChange(event.target.value)}>{children}</select>
	),
	SelectTrigger: () => null,
	SelectValue: () => null,
	SelectContent: ({ children }: { children: React.ReactNode }) => children,
	SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => <option value={value}>{children}</option>,
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
	const year = new Date().getFullYear();
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
		value: { getActivity: jest.fn().mockResolvedValue([
			{ date: `${year - 1}-12-31`, value: 3 },
			{ date: `${year}-01-01`, value: 12 },
		]) },
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
	expect(await screen.findByText('Ada')).toBeInTheDocument();
	expect(screen.getByText('Byron')).toBeInTheDocument();
	expect(screen.getByText('First name')).toBeInTheDocument();
	expect(screen.getByText('Last name')).toBeInTheDocument();
	expect(screen.getByText('user-id')).toBeInTheDocument();
	await waitFor(() => expect(screen.getByTestId('activity-heatmap')).toHaveAttribute('data-count', '2'));
	expect(screen.getByText('settings.activity.title')).toBeInTheDocument();
	expect(screen.getByText('settings.activity.description')).toBeInTheDocument();
	expect(container.querySelector('.card-body')).toBeInTheDocument();
	expect(screen.getByTestId('activity-heatmap')).toHaveAttribute('data-scale', 'linear');
	expect(screen.getByTestId('activity-heatmap')).toHaveAttribute('data-heatmap-theme', 'light');
	expect(screen.getByRole('option', { name: `settings.activity.currentYear (${year})` })).toBeInTheDocument();
	expect(screen.getByRole('option', { name: `settings.activity.lastYear (${year - 1})` })).toBeInTheDocument();
	await user.selectOptions(screen.getByRole('combobox', { name: 'settings.activity.range' }), 'lastYear');
	expect(screen.getByTestId('activity-heatmap')).toHaveAttribute('data-to', `${year - 1}-12-31`);
	expect(screen.getByTestId('activity-heatmap')).toHaveAttribute('data-count', '1');
	await user.selectOptions(screen.getByRole('combobox', { name: 'settings.activity.range' }), 'currentYear');
	expect(screen.getByTestId('activity-heatmap')).toHaveAttribute('data-count', '1');
	const cell = screen.getByRole('img', { name: 'settings.activity.day' });
	fireEvent.pointerMove(cell, { clientX: 160, clientY: 120 });
	expect(screen.getByRole('tooltip')).toHaveClass('fixed');
	expect(auth.updateProfile).not.toHaveBeenCalled();
	expect(container.querySelector('header svg')).toBeNull();
	(auth.getProfile as jest.Mock).mockResolvedValueOnce({ firstName: 'Grace', lastName: 'Hopper' });
	act(() => listener?.({ ...signedIn, user: { id: 'next-user', email: 'next@example.test' } }));
	expect(await screen.findByText('Grace')).toBeInTheDocument();
	expect(screen.getByText('Hopper')).toBeInTheDocument();
	expect(screen.queryByText('Ada')).not.toBeInTheDocument();
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
