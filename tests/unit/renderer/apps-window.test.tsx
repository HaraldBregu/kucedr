import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AppDetailsPage from '../../../src/renderer/src/pages/settings/pages/apps/details/Page';
import WindowSettings from '../../../src/renderer/src/pages/settings/pages/apps/details/Window';
import { APP_WINDOW_DEFAULTS } from '../../../src/shared/app_window_settings';

jest.mock('react-i18next', () => {
	const t = (key: string): string => key;
	return { useTranslation: () => ({ t }) };
});

const settings = { ...APP_WINDOW_DEFAULTS, width: 1200, height: 900, resizable: false };

beforeEach(() => {
	Object.defineProperty(window, 'PointerEvent', { configurable: true, value: MouseEvent });
	Object.defineProperty(window, 'apps', {
		configurable: true,
		value: {
			list: jest.fn().mockResolvedValue([
				{
					id: 'my-app',
					title: 'My App',
					description: 'Uploaded app',
					metadata: { version: '1.0.0', category: 'Tools', entry: 'index.html' },
				},
			]),
			getSettings: jest.fn().mockResolvedValue(settings),
			setSettings: jest.fn().mockResolvedValue(settings),
			open: jest.fn().mockResolvedValue(undefined),
			delete: jest.fn().mockResolvedValue(true),
		},
	});
});

it('loads settings for the selected app inside its details page', async () => {
	render(
		<MemoryRouter initialEntries={['/settings/apps/my-app']}>
			<Routes>
				<Route path="/settings/apps/:appId" element={<AppDetailsPage />} />
			</Routes>
		</MemoryRouter>
	);

	expect(await screen.findByRole('spinbutton', { name: 'settings.apps.window.width' })).toHaveValue(
		1200
	);
	expect(screen.getByRole('spinbutton', { name: 'settings.apps.window.height' })).toHaveValue(900);
	expect(screen.getByRole('switch', { name: 'settings.apps.window.resizable' })).not.toBeChecked();
	expect(window.apps.getSettings).toHaveBeenCalledWith('my-app');
	expect(screen.getByText('settings.apps.window.nextOpen')).toBeInTheDocument();
	expect(
		screen.queryByRole('button', { name: 'settings.apps.window.save' })
	).not.toBeInTheDocument();
});

it('shows app information before its window configuration', async () => {
	render(
		<MemoryRouter initialEntries={['/settings/apps/my-app']}>
			<Routes>
				<Route path="/settings/apps/:appId" element={<AppDetailsPage />} />
			</Routes>
		</MemoryRouter>
	);

	const information = await screen.findByRole('heading', { name: 'settings.apps.information' });
	const configuration = screen.getByRole('heading', { name: 'settings.apps.window.title' });
	expect(information.compareDocumentPosition(configuration)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
});

it('offers deletion from the detail page options menu', async () => {
	const user = userEvent.setup();
	render(
		<MemoryRouter initialEntries={['/settings/apps/my-app']}>
			<Routes>
				<Route path="/settings/apps" element={<p>Apps list</p>} />
				<Route path="/settings/apps/:appId" element={<AppDetailsPage />} />
			</Routes>
		</MemoryRouter>
	);

	await screen.findByText('My App');
	await user.click(screen.getByRole('button', { name: 'common.moreOptions' }));
	await user.click(screen.getByRole('menuitem', { name: 'settings.apps.deleteAction' }));

	expect(window.apps.delete).toHaveBeenCalledWith('my-app');
	expect(await screen.findByText('Apps list')).toBeInTheDocument();
});

it('automatically saves edited dimensions and behavior for only the selected app', async () => {
	const user = userEvent.setup();
	const updated = { ...settings, width: 1400, resizable: true, maximizable: false };
	(window.apps.setSettings as jest.Mock).mockResolvedValue(updated);
	render(<WindowSettings appId="my-app" />);
	const width = await screen.findByRole('spinbutton', { name: 'settings.apps.window.width' });
	await user.clear(width);
	await user.type(width, '1400');
	await user.click(screen.getByRole('switch', { name: 'settings.apps.window.resizable' }));
	await user.click(screen.getByRole('switch', { name: 'settings.apps.window.maximizable' }));

	await waitFor(() => expect(window.apps.setSettings).toHaveBeenCalledWith('my-app', updated));
	expect(await screen.findByText('settings.apps.window.saved')).toBeInTheDocument();
	expect(
		screen.queryByRole('button', { name: 'settings.apps.window.save' })
	).not.toBeInTheDocument();
});

it('restores default window values without showing custom controls', async () => {
	const user = userEvent.setup();
	(window.apps.setSettings as jest.Mock).mockResolvedValue(APP_WINDOW_DEFAULTS);
	render(<WindowSettings appId="my-app" />);

	await screen.findByRole('spinbutton', { name: 'settings.apps.window.width' });
	await user.click(screen.getByRole('combobox', { name: 'settings.apps.window.values' }));
	await user.click(screen.getByRole('option', { name: 'settings.apps.window.default' }));

	await waitFor(() => expect(window.apps.setSettings).toHaveBeenCalledWith('my-app', {}));
	expect(screen.queryByRole('spinbutton', { name: 'settings.apps.window.width' })).not.toBeInTheDocument();
	expect(await screen.findByText('settings.apps.window.saved')).toBeInTheDocument();
});

it('disables editing and duplicate saves while settings are being saved', async () => {
	let complete!: (value: typeof settings) => void;
	(window.apps.setSettings as jest.Mock).mockReturnValue(
		new Promise((resolve) => {
			complete = resolve;
		})
	);
	render(<WindowSettings appId="my-app" />);
	const width = await screen.findByRole('spinbutton', { name: 'settings.apps.window.width' });
	fireEvent.change(width, { target: { value: '1400' } });
	await waitFor(() =>
		expect(window.apps.setSettings).toHaveBeenCalledWith('my-app', { ...settings, width: 1400 })
	);
	expect(width).toBeDisabled();
	expect(screen.getByRole('switch', { name: 'settings.apps.window.resizable' })).toHaveAttribute(
		'aria-disabled',
		'true'
	);
	expect(screen.getByText('settings.apps.window.saving')).toBeInTheDocument();
	expect(window.apps.setSettings).toHaveBeenCalledTimes(1);
	complete({ ...settings, width: 1400 });
	expect(await screen.findByText('settings.apps.window.saved')).toBeInTheDocument();
});

it.each(['', '0', '-1', '1.5', '32769', '619'])(
	'prevents saving invalid width %s',
	async (value) => {
		render(<WindowSettings appId="my-app" />);
		const width = await screen.findByRole('spinbutton', { name: 'settings.apps.window.width' });
		fireEvent.change(width, { target: { value } });
		expect(screen.getByRole('alert')).toHaveTextContent('settings.apps.window.invalid');
		expect(
			screen.queryByRole('button', { name: 'settings.apps.window.save' })
		).not.toBeInTheDocument();
		await new Promise((resolve) => window.setTimeout(resolve, 350));
		expect(window.apps.setSettings).not.toHaveBeenCalled();
	}
);

it('prevents minimum height exceeding default height', async () => {
	render(<WindowSettings appId="my-app" />);
	const minimum = await screen.findByRole('spinbutton', { name: 'settings.apps.window.minHeight' });
	fireEvent.change(minimum, { target: { value: '901' } });
	expect(
		screen.queryByRole('button', { name: 'settings.apps.window.save' })
	).not.toBeInTheDocument();
	expect(screen.getByRole('alert')).toHaveTextContent('settings.apps.window.invalid');
});

it('offers retry after a load error and keeps the form unavailable until loaded', async () => {
	const user = userEvent.setup();
	(window.apps.getSettings as jest.Mock).mockRejectedValueOnce(new Error('Read failed'));
	render(<WindowSettings appId="my-app" />);
	expect(await screen.findByRole('alert')).toHaveTextContent('settings.apps.window.loadError');
	expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
	await user.click(screen.getByRole('button', { name: 'settings.apps.refresh' }));
	expect(await screen.findByRole('spinbutton', { name: 'settings.apps.window.width' })).toHaveValue(
		1200
	);
	expect(window.apps.getSettings).toHaveBeenCalledTimes(2);
});

it('preserves edits and retries after the next valid change when automatic saving fails', async () => {
	(window.apps.setSettings as jest.Mock).mockRejectedValueOnce(new Error('Write failed'));
	render(<WindowSettings appId="my-app" />);
	const width = await screen.findByRole('spinbutton', { name: 'settings.apps.window.width' });
	fireEvent.change(width, { target: { value: '1400' } });
	expect(await screen.findByRole('alert')).toHaveTextContent('settings.apps.window.saveError');
	expect(width).toHaveValue(1400);
	fireEvent.change(width, { target: { value: '1401' } });
	expect(await screen.findByText('settings.apps.window.saved')).toBeInTheDocument();
	expect(window.apps.setSettings).toHaveBeenCalledTimes(2);
});
