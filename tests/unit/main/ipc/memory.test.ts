const registerCommandWithEvent = jest.fn();
const registerQueryWithEvent = jest.fn();
const fromWebContents = jest.fn();

jest.mock('../../../../src/main/ipc/core/gateway', () => ({
	registerCommandWithEvent,
	registerQueryWithEvent,
}));
jest.mock('electron', () => ({ BrowserWindow: { fromWebContents } }));

import { MemoryIpc } from '../../../../src/main/ipc/memory';
import { MemoryChannels } from '../../../../src/shared/ipc_channels_definitions';

const memory = Object.fromEntries(Object.keys(MemoryChannels).map((key) => [key, jest.fn()]));
const windows = { has: jest.fn() };
const apps = { has: jest.fn() };
const frame = {};
const sender = { mainFrame: frame };
const event = { sender, senderFrame: frame };

beforeEach(() => {
	jest.clearAllMocks();
	apps.has.mockReturnValue(false);
	windows.has.mockReturnValue(true);
	fromWebContents.mockReturnValue({ id: 1, webContents: sender });
	new MemoryIpc().register({
		windows: windows as never,
		apps: apps as never,
		memory: memory as never,
	});
});

it.each(['subframe', 'app', 'unknown'])(
	'rejects every memory endpoint from an untrusted %s renderer',
	(kind) => {
		if (kind === 'app') apps.has.mockReturnValue(true);
		if (kind === 'unknown') windows.has.mockReturnValue(false);
		const incoming = kind === 'subframe' ? { ...event, senderFrame: {} } : event;
		const handlers = [...registerCommandWithEvent.mock.calls, ...registerQueryWithEvent.mock.calls];
		expect(handlers).toHaveLength(Object.keys(MemoryChannels).length);
		for (const [, handler] of handlers) expect(() => handler(incoming)).toThrow('Privileged IPC');
		for (const method of Object.values(memory)) expect(method).not.toHaveBeenCalled();
	}
);

it('forwards the expected document for a trusted editor update', () => {
	const handler = registerCommandWithEvent.mock.calls.find(
		([channel]) => channel === MemoryChannels.edit
	)?.[1];
	handler(event, 'New notes', 'Original notes');
	expect(memory.edit).toHaveBeenCalledWith('New notes', 'Original notes');
});
