const invoke = jest.fn();
jest.mock('electron', () => ({ ipcRenderer: { invoke } }));

import { database } from '../../../../src/preload/database';
import { DatabaseChannels } from '../../../../src/shared/ipc_channels_definitions';

beforeEach(() => {
	jest.clearAllMocks();
	invoke.mockResolvedValue({ success: true, data: [] });
});

it('lists adapter-backed vector databases through the typed database channel', async () => {
	await database.list();
	expect(invoke).toHaveBeenCalledWith(DatabaseChannels.list);
});
