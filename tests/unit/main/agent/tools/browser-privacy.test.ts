import type { Session } from 'electron';
import { createBackgroundBrowser } from '../../../../../src/main/agent/tools/web/browser/background';
import { favicon } from '../../../../../src/main/agent/tools/web/browser/favicon';
import { guard } from '../../../../../src/main/agent/tools/web/browser/guard';
import { prepare } from '../../../../../src/main/agent/tools/web/browser/prepare';
import { wake } from '../../../../../src/main/browser/wake';
import { openExternal } from '../../../../../src/main/handoff';
import { publicUrl } from '../../../../../src/main/public';

const mockSetProxy = jest.fn();
const mockSession = {
	getUserAgent: () => 'Chrome/141 Electron/44 Kucedr/1',
	setUserAgent: jest.fn(),
	setPermissionRequestHandler: jest.fn(),
	setPermissionCheckHandler: jest.fn(),
	on: jest.fn(),
	setProxy: mockSetProxy,
};
const mockPrivacy = { enabled: false, proxy: undefined as string | undefined };
const mockFindTor = jest.fn();
const mockOpenExternal = jest.fn();
const mockLookup = jest.fn();
const mockLaunch = jest.fn();

jest.mock('electron', () => ({
	app: { getName: () => 'Kucedr' },
	session: { fromPartition: () => mockSession },
	shell: { openExternal: (...args: unknown[]) => mockOpenExternal(...args) },
}));
jest.mock('node:dns/promises', () => ({ lookup: (...args: unknown[]) => mockLookup(...args) }));
jest.mock('playwright-core', () => ({ chromium: { launchPersistentContext: (...args: unknown[]) => mockLaunch(...args) } }));
jest.mock('../../../../../src/main/agent/tools/web/browser/guard', () => ({ guard: jest.fn() }));
jest.mock('../../../../../src/main/agent/tools/web/browser/hold', () => ({
	holdDownload: jest.fn(),
}));
jest.mock('../../../../../src/main/browser/connections', () => ({
	connections: () => ({ proxy: 'http://proxy.example:8080' }),
}));
jest.mock('../../../../../src/main/browser/tor', () => ({ findTor: () => mockFindTor() }));
jest.mock('../../../../../src/main/privacy/state', () => ({
	isPrivacyEnabled: () => mockPrivacy.enabled,
	getPrivacyRoute: () => mockPrivacy.proxy,
	requireUnrestrictedNetwork: () => {
		if (mockPrivacy.enabled) throw new Error('Unavailable while Privacy Mode is on.');
	},
}));

beforeEach(() => {
	jest.clearAllMocks();
	mockSetProxy.mockResolvedValue(undefined);
	mockPrivacy.enabled = true;
	mockPrivacy.proxy = 'socks5://127.0.0.1:1080';
});

it.each(['direct', 'private', 'proxy'] as const)(
	'keeps %s requests blocked until the app proxy is configured',
	async (route) => {
		let openProxy!: () => void;
		mockSetProxy.mockReturnValueOnce(
			new Promise<void>((resolve) => {
				openProxy = resolve;
			})
		);
		const ready = prepare(`app-${route}`, route);
		const [, routed, open] = jest.mocked(guard).mock.calls[0];
		expect(routed).toBe(true);
		expect(open()).toBe(false);
		await Promise.resolve();
		expect(mockSetProxy).toHaveBeenCalledWith({
			mode: 'fixed_servers',
			proxyRules: mockPrivacy.proxy,
			proxyBypassRules: '<-loopback>',
		});
		openProxy();
		await ready;
		expect(open()).toBe(true);
	}
);

it('stays blocked without an app route and does not fall back to the saved browser proxy', async () => {
	mockPrivacy.proxy = undefined;
	await expect(prepare('app-blocked', 'proxy')).rejects.toThrow(
		'Privacy Mode is blocking online access.'
	);
	expect(jest.mocked(guard).mock.calls[0][2]()).toBe(false);
	expect(mockSetProxy).not.toHaveBeenCalled();
});

it('keeps the guard closed when Electron rejects the proxy settings', async () => {
	mockSetProxy.mockRejectedValueOnce(new Error('Proxy settings rejected'));
	await expect(prepare('app-proxy-error', 'direct')).rejects.toThrow('Proxy settings rejected');
	expect(jest.mocked(guard).mock.calls[0][2]()).toBe(false);
});

it('rejects the independent Tor route while Privacy Mode is on', async () => {
	await expect(prepare('app-tor', 'tor')).rejects.toThrow('Tor tabs are unavailable');
	expect(jest.mocked(guard).mock.calls[0][2]()).toBe(false);
	expect(mockSetProxy).not.toHaveBeenCalled();
	expect(mockFindTor).not.toHaveBeenCalled();
});

it('keeps ordinary and proxy tab routing when Privacy Mode is off', async () => {
	mockPrivacy.enabled = false;
	await prepare('legacy-direct', 'direct');
	expect(jest.mocked(guard).mock.calls[0][1]).toBe(false);
	expect(mockSetProxy).not.toHaveBeenCalled();
	await prepare('legacy-proxy', 'proxy');
	expect(mockSetProxy).toHaveBeenCalledWith(
		expect.objectContaining({ proxyRules: 'http://proxy.example:8080' })
	);
});

it('passes only image data to the renderer after fetching HTTPS in the tab session', async () => {
	const fetch = jest.fn().mockResolvedValue(
		new Response(new Uint8Array([1, 2, 3]), {
			headers: { 'content-type': 'image/png' },
		})
	);
	await expect(
		favicon({ fetch } as unknown as Session, 'https://example.com/icon.png')
	).resolves.toBe('data:image/png;base64,AQID');
	expect(fetch).toHaveBeenCalledWith('https://example.com/icon.png', {
		signal: expect.any(AbortSignal),
	});
});

it('cancels a favicon response once its byte limit is exceeded', async () => {
	const cancel = jest.fn();
	const body = new ReadableStream({
		start: (controller) => controller.enqueue(new Uint8Array(200_001)),
		cancel,
	});
	const fetch = jest.fn().mockResolvedValue(new Response(body, { headers: { 'content-type': 'image/png' } }));
	await expect(favicon({ fetch } as unknown as Session, 'https://example.com/icon.png')).resolves.toBeUndefined();
	expect(cancel).toHaveBeenCalledTimes(1);
});

it('waits for the route before restoring a previously open tab', async () => {
	let allow!: () => void;
	const ready = new Promise<void>((resolve) => {
		allow = resolve;
	});
	const restore = jest.fn().mockResolvedValue(undefined);
	const pending = { entries: [{ url: 'https://example.com', title: 'Example' }], index: 0 };
	const tab = {
		ready,
		pending,
		view: { webContents: { isDestroyed: () => false, navigationHistory: { restore } } },
	} as unknown as Parameters<typeof wake>[0];
	const waking = wake(tab);
	const duplicate = wake(tab);
	expect(restore).not.toHaveBeenCalled();
	allow();
	await Promise.all([waking, duplicate]);
	expect(restore).toHaveBeenCalledTimes(1);
	expect(restore).toHaveBeenCalledWith(pending);
});

it('stops direct DNS, external handoffs and unmanaged Chrome before they start', async () => {
	await expect(publicUrl('https://example.com')).rejects.toThrow('Privacy Mode');
	await expect(openExternal('https://example.com')).rejects.toThrow('Privacy Mode');
	await expect(createBackgroundBrowser().tool.run({ action: 'start' })).rejects.toThrow('Privacy Mode');
	expect(mockLookup).not.toHaveBeenCalled();
	expect(mockOpenExternal).not.toHaveBeenCalled();
	expect(mockLaunch).not.toHaveBeenCalled();
});
