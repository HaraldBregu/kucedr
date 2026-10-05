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

it('adds dropped files through the typed library channel', async () => {
	invoke.mockResolvedValue({ success: true, data: [] });

	await expect(library.add(['/tmp/notes.txt'])).resolves.toEqual([]);
	expect(invoke).toHaveBeenCalledWith(LibraryChannels.add, ['/tmp/notes.txt'], undefined);
});

it('deletes files through the typed library channel', async () => {
	invoke.mockResolvedValue({ success: true, data: undefined });

	await expect(library.delete('documents/notes.txt')).resolves.toBeUndefined();
	expect(invoke).toHaveBeenCalledWith(LibraryChannels.delete, 'documents/notes.txt');
});
