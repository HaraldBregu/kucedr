import { BrowserWindow, Menu as ElectronMenu } from 'electron';
import { Menu } from '../../../../src/main/menu';

jest.mock('@electron-toolkit/utils', () => ({ is: { dev: true } }));
jest.mock('../../../../src/main/i18n', () => ({
	loadTranslations: () => ({
		apps: 'Apps',
		view: 'View',
		back: 'Back',
		forward: 'Forward',
	}),
}));

type MenuEntry = {
	label?: string;
	accelerator?: string;
	type?: string;
	submenu?: MenuEntry[];
	click?: () => void;
};

describe('application menu apps', () => {
	it('keeps the platform new-session shortcut available', () => {
		const onNewWindow = jest.fn();
		const buildFromTemplate = ElectronMenu.buildFromTemplate as jest.Mock;
		buildFromTemplate.mockImplementation((template: MenuEntry[]) => template);
		const menu = new Menu({
			onLanguageChange: jest.fn(),
			onNewWindow,
			getApps: () => [],
			onOpenApp: jest.fn(),
		});

		menu.create();

		const template = buildFromTemplate.mock.calls[0][0] as MenuEntry[];
		const newWindow = template[process.platform === 'darwin' ? 1 : 0].submenu?.[0];
		expect(newWindow?.accelerator).toBe('CmdOrCtrl+Shift+N');
		newWindow?.click?.();
		expect(onNewWindow).toHaveBeenCalledTimes(1);
	});

	it('opens manifest-defined apps from the Apps menu', () => {
		const appConfigurations = [
			{
				id: 'weather',
				title: 'Weather',
				description: 'Local forecast',
				metadata: { version: '1.0.0', category: 'information', entry: 'index.html' },
			},
			{
				id: 'clock',
				title: 'World Clock',
				description: 'Times around the world',
				metadata: { version: '2.0.0', category: 'utility', entry: 'index.html' },
			},
		];
		const onOpenApp = jest.fn();
		const buildFromTemplate = ElectronMenu.buildFromTemplate as jest.Mock;
		buildFromTemplate.mockClear();
		buildFromTemplate.mockImplementation((template: MenuEntry[]) => template);
		const menu = new Menu({
			onLanguageChange: jest.fn(),
			onNewWindow: jest.fn(),
			getApps: () => appConfigurations,
			onOpenApp,
		});

		menu.create();

		const template = buildFromTemplate.mock.calls[0][0] as MenuEntry[];
		const appsMenu = template.find((entry) => entry.label === 'Apps');
		appsMenu?.submenu?.find((entry) => entry.label === 'Weather')?.click?.();
		appsMenu?.submenu?.find((entry) => entry.label === 'World Clock')?.click?.();

		expect(onOpenApp).toHaveBeenNthCalledWith(1, appConfigurations[0]);
		expect(onOpenApp).toHaveBeenNthCalledWith(2, appConfigurations[1]);
	});

	it('provides macOS back and forward navigation shortcuts', () => {
		if (process.platform !== 'darwin') return;

		const goBack = jest.fn();
		const goForward = jest.fn();
		(BrowserWindow.getFocusedWindow as jest.Mock).mockReturnValue({
			webContents: {
				navigationHistory: {
					canGoBack: () => true,
					canGoForward: () => true,
					goBack,
					goForward,
				},
			},
		});
		const buildFromTemplate = ElectronMenu.buildFromTemplate as jest.Mock;
		buildFromTemplate.mockImplementation((template: MenuEntry[]) => template);
		new Menu({
			onLanguageChange: jest.fn(),
			onNewWindow: jest.fn(),
			getApps: () => [],
			onOpenApp: jest.fn(),
		}).create();

		const template = buildFromTemplate.mock.calls.at(-1)?.[0] as MenuEntry[];
		const view = template.find((entry) => entry.label === 'View')?.submenu;
		const back = view?.find((entry) => entry.accelerator === 'Cmd+[');
		const forward = view?.find((entry) => entry.accelerator === 'Cmd+]');
		back?.click?.();
		forward?.click?.();

		expect(back).toBeDefined();
		expect(forward).toBeDefined();
		expect(goBack).toHaveBeenCalledTimes(1);
		expect(goForward).toHaveBeenCalledTimes(1);
	});

	it('rebuilds the Apps submenu from the current app list', () => {
		let apps = [
			{
				id: 'weather',
				title: 'Weather',
				description: 'Local forecast',
				metadata: { version: '1.0.0', category: 'information', entry: 'index.html' },
			},
		];
		const buildFromTemplate = ElectronMenu.buildFromTemplate as jest.Mock;
		buildFromTemplate.mockClear();
		buildFromTemplate.mockImplementation((template: MenuEntry[]) => template);
		const menu = new Menu({
			onLanguageChange: jest.fn(),
			onNewWindow: jest.fn(),
			getApps: () => apps,
			onOpenApp: jest.fn(),
		});
		menu.create();
		apps = [
			{
				id: 'clock',
				title: 'World Clock',
				description: 'Times around the world',
				metadata: { version: '2.0.0', category: 'utility', entry: 'index.html' },
			},
		];

		menu.create();

		const template = buildFromTemplate.mock.calls[1][0] as MenuEntry[];
		const appsMenu = template.find((entry) => entry.label === 'Apps');
		expect(appsMenu?.submenu?.map((entry) => entry.label)).toEqual(['World Clock']);
	});
});
