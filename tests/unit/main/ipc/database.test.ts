const registerCommandWithEvent = jest.fn();
const registerQueryWithEvent = jest.fn();
const getDatabaseConfiguration = jest.fn();
const saveDatabaseConfiguration = jest.fn();
const listVectorDatabases = jest.fn();

jest.mock('../../../../src/main/ipc/core/gateway', () => ({
	registerCommandWithEvent,
	registerQueryWithEvent,
}));
jest.mock('../../../../src/main/database/database_store', () => ({
	getDatabaseConfiguration,
	saveDatabaseConfiguration,
}));
jest.mock('../../../../src/main/database/vector_adapters', () => ({ listVectorDatabases }));

import { BrowserWindow } from 'electron';
import { DatabaseIpc } from '../../../../src/main/ipc/database';
import { DatabaseChannels } from '../../../../src/shared/ipc_channels_definitions';

const apps = { has: jest.fn() };
const windows = { has: jest.fn() };
const mainFrame = {};
const sender = { id: 1, mainFrame };
const event = { sender, senderFrame: mainFrame };

beforeEach(() => {
	jest.clearAllMocks();
	apps.has.mockReturnValue(false);
	windows.has.mockReturnValue(true);
	(BrowserWindow.fromWebContents as jest.Mock).mockReturnValue({ id: 1, webContents: sender });
	listVectorDatabases.mockReturnValue([
		{
			providerId: 'pinecone',
			databaseId: 'pinecone',
			providerName: 'Pinecone',
			databaseName: 'Pinecone Vector Database',
		},
	]);
	new DatabaseIpc().register({ apps: apps as never, windows: windows as never }, {} as never);
});

it('lists only main-process-supported vector databases through the trusted API', () => {
	const handler = registerQueryWithEvent.mock.calls.find(
		([channel]) => channel === DatabaseChannels.list
	)?.[1];
	expect(handler(event)).toEqual([
		{
			providerId: 'pinecone',
			databaseId: 'pinecone',
			providerName: 'Pinecone',
			databaseName: 'Pinecone Vector Database',
		},
	]);
});
