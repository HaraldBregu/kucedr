const invoke = jest.fn();

jest.mock('electron', () => ({ ipcRenderer: { invoke } }));

import { library } from '../../../../src/preload/library';
import { LibraryChannels } from '../../../../src/shared/ipc_channels_definitions';

it('lists library files through the typed library channel', async () => {
	const files = [
		{
			name: 'notes.txt',
			path: '/library/documents/notes.txt',
			relativePath: 'documents/notes.txt',
			size: 5,
			modifiedAt: '2026-09-29',
		},
	];
	invoke.mockResolvedValue({ success: true, data: files });

	await expect(library.list()).resolves.toEqual(files);
	expect(invoke).toHaveBeenCalledWith(LibraryChannels.list);
});
