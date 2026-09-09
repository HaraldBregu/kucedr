export const app = {
	getName: (): string => 'Kucedr',
	getAppPath: (): string => process.cwd(),
	getPath: (): string => process.cwd(),
	getVersion: (): string => '0.0.0-test',
	isPackaged: false,
	isReady: jest.fn(() => true),
	once: jest.fn(),
	quit: jest.fn(),
	exit: jest.fn(),
};

export const ipcMain = {
	handle: jest.fn(),
	on: jest.fn(),
	removeHandler: jest.fn(),
};

export const shell = {
	openExternal: jest.fn(async () => undefined),
	openPath: jest.fn(async () => ''),
};

export const clipboard = {
	writeText: jest.fn(),
};

export const systemPreferences = {
	askForMediaAccess: jest.fn(async () => true),
	getMediaAccessStatus: jest.fn(() => 'unknown'),
};

export const BrowserWindow = Object.assign(jest.fn(), {
	getAllWindows: jest.fn(() => []),
	getFocusedWindow: jest.fn(() => null),
	fromWebContents: jest.fn(() => null),
});

export const WebContentsView = jest.fn();

export const webContents = {
	getAllWebContents: jest.fn(() => []),
	fromFrame: jest.fn((frame: { webContents?: unknown }) => frame.webContents),
};

export const dialog = {
	showMessageBox: jest.fn(async () => ({ response: 0, checkboxChecked: false })),
	showOpenDialog: jest.fn(async () => ({ canceled: true, filePaths: [] })),
};

export const Menu = {
	buildFromTemplate: jest.fn(() => ({})),
	setApplicationMenu: jest.fn(),
};

export const Tray = jest.fn();

export const nativeImage = {
	createFromPath: jest.fn(() => ({})),
};

export const protocol = {
	handle: jest.fn(),
	registerSchemesAsPrivileged: jest.fn(),
};

const appSession = {
	protocol: { handle: jest.fn() },
	setPermissionCheckHandler: jest.fn(),
	setPermissionRequestHandler: jest.fn(),
	setDisplayMediaRequestHandler: jest.fn(),
};

export const session = {
	defaultSession: {
		setPermissionCheckHandler: jest.fn(),
		setPermissionRequestHandler: jest.fn(),
		setDisplayMediaRequestHandler: jest.fn(),
	},
	fromPartition: jest.fn(() => appSession),
};

export const net = {
	fetch: jest.fn(),
};

export const desktopCapturer = {
	getSources: jest.fn(),
};

export const crashReporter = {
	start: jest.fn(),
};

export const powerSaveBlocker = {
	start: jest.fn(() => 1),
	stop: jest.fn(() => true),
	isStarted: jest.fn(() => true),
};

export const safeStorage = {
	isEncryptionAvailable: jest.fn(() => true),
	getSelectedStorageBackend: jest.fn(() => 'gnome_libsecret'),
	encryptString: jest.fn((value: string) => Buffer.from(value, 'utf8')),
	decryptString: jest.fn((value: Buffer) => value.toString('utf8')),
};
