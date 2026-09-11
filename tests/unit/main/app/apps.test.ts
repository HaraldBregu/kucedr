import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { BrowserWindow, WebContentsView } from 'electron';
import type { WindowFactory } from '../../../../src/main/window_factory';
import {
	ensureApps,
	listApps,
	loadApp,
} from '../../../../src/main/apps/app_index';
import { appEntryPath } from '../../../../src/main/apps/app_entry';
import { appManifestPath } from '../../../../src/main/apps/app_manifest';
import type { AppManifest } from '../../../../src/main/apps/app_types';

function createWindowHarness() {
	const handlers = new Map<string, () => void>();
	const shellHandlers = new Map<string, () => void>();
	const webContents = {
		isDestroyed: jest.fn(() => false),
		on: jest.fn((event: string, handler: () => void) => shellHandlers.set(event, handler)),
		once: jest.fn((event: string, handler: () => void) => shellHandlers.set(event, handler)),
		send: jest.fn(),
	};
	const viewWebContents = {
		close: jest.fn(),
		isDestroyed: jest.fn(() => false),
		on: jest.fn(),
		once: jest.fn(),
		send: jest.fn(),
	};
	const view = {
		setBounds: jest.fn(),
		setVisible: jest.fn(),
		webContents: viewWebContents,
	} as unknown as WebContentsView;
	const win = {
		close: jest.fn(),
		contentView: { addChildView: jest.fn() },
		destroy: jest.fn(),
		focus: jest.fn(),
		getContentBounds: jest.fn(() => ({ x: 0, y: 0, width: 820, height: 640 })),
		isDestroyed: jest.fn(() => false),
		isMinimized: jest.fn(() => false),
		isVisible: jest.fn(() => true),
		restore: jest.fn(),
		setMenuBarVisibility: jest.fn(),
		setTitle: jest.fn(),
		show: jest.fn(),
		once: jest.fn((event: string, handler: () => void) => handlers.set(event, handler)),
		on: jest.fn((event: string, handler: () => void) => handlers.set(event, handler)),
		webContents,
	} as unknown as BrowserWindow;
	const create = jest.fn(() => win);
	const load = jest.fn(() => Promise.resolve());
	const createView = jest.fn(() => ({ view, load }));
	const windowFactory = { create, createView } as unknown as WindowFactory;
	return { create, createView, handlers, load, shellHandlers, view, win, windowFactory };
}

function installApp(
	appLocation: string,
	id: string,
	manifest: AppManifest,
	contents = '<h1>App</h1>'
): string {
	const entry = appEntryPath(id, manifest.metadata.entry, appLocation);
	fs.mkdirSync(path.dirname(entry), { recursive: true });
	fs.writeFileSync(entry, contents);
	fs.writeFileSync(appManifestPath(id, appLocation), JSON.stringify(manifest));
	return entry;
}

describe('app discovery and loading', () => {
	let appLocation: string;
	const projectManifest: AppManifest = {
		title: 'Project',
		description: 'A compact project board for tracking work from backlog to completion.',
		metadata: {
			version: '1.0.0',
			category: 'project-management',
			entry: 'index.html',
		},
	};

	beforeEach(() => {
		appLocation = fs.mkdtempSync(path.join(os.tmpdir(), 'kucedr-apps-'));
	});

	afterEach(() => {
		fs.rmSync(appLocation, { recursive: true, force: true });
	});

	it('initializes an empty app directory', () => {
		expect(ensureApps(appLocation)).toEqual([]);
		expect(fs.readdirSync(path.join(appLocation, 'apps'))).toEqual([]);
	});

	it('discovers app folders from their manifests', () => {
		installApp(appLocation, 'project', projectManifest);

		expect(listApps(appLocation)).toEqual([{ id: 'project', ...projectManifest }]);
	});

	it('uses metadata.entry and preserves additional metadata', () => {
		const manifest: AppManifest = {
			...projectManifest,
			metadata: {
				...projectManifest.metadata,
				entry: 'pages/project.html',
				author: 'Kucedr',
			},
		};
		installApp(appLocation, 'project', manifest);

		expect(listApps(appLocation)).toEqual([{ id: 'project', ...manifest }]);
	});

	it('sorts discovered apps by folder name', () => {
		installApp(appLocation, 'weather', { ...projectManifest, title: 'Weather' });
		installApp(appLocation, 'clock', { ...projectManifest, title: 'Clock' });

		expect(listApps(appLocation).map(({ id }) => id)).toEqual(['clock', 'weather']);
	});

	it('omits folders whose manifest is missing or invalid', () => {
		const entry = appEntryPath('notes', 'index.html', appLocation);
		fs.mkdirSync(path.dirname(entry), { recursive: true });
		fs.writeFileSync(entry, '<h1>Notes</h1>');
		expect(listApps(appLocation)).toEqual([]);

		fs.writeFileSync(
			appManifestPath('notes', appLocation),
			JSON.stringify({ name: 'Notes', description: 'Old schema', metadata: {} })
		);
		expect(listApps(appLocation)).toEqual([]);
	});

	it('omits apps whose manifest entry is missing or unsafe', () => {
		fs.mkdirSync(path.dirname(appManifestPath('missing', appLocation)), { recursive: true });
		fs.writeFileSync(
			appManifestPath('missing', appLocation),
			JSON.stringify(projectManifest)
		);
		fs.mkdirSync(path.dirname(appManifestPath('unsafe', appLocation)), { recursive: true });
		fs.writeFileSync(
			appManifestPath('unsafe', appLocation),
			JSON.stringify({
				...projectManifest,
				metadata: { ...projectManifest.metadata, entry: '../outside.html' },
			})
		);

		expect(listApps(appLocation)).toEqual([]);
	});

	it('loads the manifest entry below the app titlebar', async () => {
		const manifest: AppManifest = {
			...projectManifest,
			metadata: { ...projectManifest.metadata, entry: 'pages/project.html' },
		};
		const entry = installApp(appLocation, 'project', manifest);
		const app = { id: 'project', ...manifest };
		const { create, createView, handlers, load, shellHandlers, view, win, windowFactory } =
			createWindowHarness();

		expect(loadApp(windowFactory, app, appLocation)).toBe(win);
		expect(create).toHaveBeenCalledWith(
			expect.objectContaining({
				frame: false,
				title: 'Project',
				resizable: true,
			}),
			{ html: 'app.html', hash: 'app/Project' }
		);
		expect(createView).not.toHaveBeenCalled();

		shellHandlers.get('did-finish-load')?.();
		expect(createView).toHaveBeenCalledWith(entry, 'project');
		expect(win.contentView.addChildView).toHaveBeenCalledWith(view);
		expect(view.setBounds).toHaveBeenCalledWith({ x: 0, y: 48, width: 820, height: 592 });
		expect(load).toHaveBeenCalledTimes(1);
		handlers.get('ready-to-show')?.();
		await new Promise((resolve) => setImmediate(resolve));
		expect(win.show).toHaveBeenCalledTimes(1);
		handlers.get('closed')?.();
	});

	it('does not open a window when the manifest entry is missing', () => {
		const app = { id: 'project', ...projectManifest };
		const { create, windowFactory } = createWindowHarness();
		const entry = installApp(appLocation, 'project', projectManifest);
		fs.unlinkSync(entry);

		expect(() => loadApp(windowFactory, app, appLocation)).toThrow(
			'App entry not found: project'
		);
		expect(create).not.toHaveBeenCalled();
	});

	it('rereads the manifest before creating a window even when the caller has stale metadata', () => {
		const stale = { id: 'project', ...projectManifest };
		installApp(appLocation, 'project', {
			...projectManifest,
			title: 'Updated Project',
			metadata: { ...projectManifest.metadata, entry: 'new.html' },
			window: { width: 1000, height: 700, minWidth: 500, minHeight: 300, resizable: false, maximizable: false },
		});
		const { create, createView, handlers, shellHandlers, windowFactory } = createWindowHarness();
		loadApp(windowFactory, stale, appLocation);
		expect(create).toHaveBeenCalledWith(expect.objectContaining({
			title: 'Updated Project', width: 1000, height: 700, minWidth: 500, minHeight: 300,
			resizable: false, maximizable: false,
		}), { html: 'app.html', hash: 'app/Updated%20Project' });
		shellHandlers.get('did-finish-load')?.();
		expect(createView).toHaveBeenCalledWith(appEntryPath('project', 'new.html', appLocation), 'project');
		handlers.get('closed')?.();
	});

	it('rejects a missing or invalid current manifest before creating a window', () => {
		const stale = { id: 'project', ...projectManifest };
		const { create, windowFactory } = createWindowHarness();
		expect(() => loadApp(windowFactory, stale, appLocation)).toThrow('App manifest not found or invalid');
		installApp(appLocation, 'project', projectManifest);
		fs.writeFileSync(appManifestPath('project', appLocation), JSON.stringify({
			...projectManifest, window: { width: -1 },
		}));
		expect(() => loadApp(windowFactory, stale, appLocation)).toThrow('App manifest not found or invalid');
		expect(create).not.toHaveBeenCalled();
	});

	it('keeps an existing window and uses new dimensions after it closes', () => {
		const app = { id: 'project', ...projectManifest };
		installApp(appLocation, 'project', projectManifest);
		const { create, handlers, windowFactory } = createWindowHarness();
		loadApp(windowFactory, app, appLocation);
		expect(create.mock.calls[0][0]).toMatchObject({ width: 820, height: 640, minWidth: 620, minHeight: 480 });
		installApp(appLocation, 'project', { ...projectManifest, window: { width: 420, height: 320 } });
		loadApp(windowFactory, app, appLocation);
		expect(create).toHaveBeenCalledTimes(1);
		handlers.get('closed')?.();
		loadApp(windowFactory, app, appLocation);
		expect(create).toHaveBeenCalledTimes(2);
		expect(create.mock.calls[1][0]).toMatchObject({ width: 420, height: 320, minWidth: 420, minHeight: 320 });
		handlers.get('closed')?.();
	});

	it('reuses an app window while its titlebar is still loading', () => {
		const manifest: AppManifest = {
			...projectManifest,
			metadata: { ...projectManifest.metadata, entry: 'pages/project.html' },
		};
		installApp(appLocation, 'project', manifest);
		const app = { id: 'project', ...manifest };
		const { create, createView, handlers, win, windowFactory } = createWindowHarness();

		const firstWindow = loadApp(windowFactory, app, appLocation);
		expect(firstWindow).toBe(win);
		expect(create).toHaveBeenCalledTimes(1);

		const secondWindow = loadApp(windowFactory, app, appLocation);
		expect(secondWindow).toBe(win);
		expect(create).toHaveBeenCalledTimes(1);
		expect(createView).not.toHaveBeenCalled();
		expect(win.focus).toHaveBeenCalledTimes(1);
		expect(win.show).toHaveBeenCalledTimes(0);
		expect(win.isDestroyed).toHaveBeenCalledTimes(1);
		expect(win.isMinimized).toHaveBeenCalledTimes(1);
		expect(win.isVisible).not.toHaveBeenCalled();
		handlers.get('closed')?.();
	});

	it('rejects app paths outside the apps folder', () => {
		expect(() => appEntryPath('../outside', 'index.html', appLocation)).toThrow(
			'Invalid app id'
		);
		expect(() => appEntryPath('project', '../outside.html', appLocation)).toThrow(
			'Invalid app entry'
		);
	});
});
