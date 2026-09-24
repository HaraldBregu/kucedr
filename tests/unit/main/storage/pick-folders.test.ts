import { BrowserWindow, dialog } from 'electron';
import { pickFolders } from '../../../../src/main/storage/storage_pick_folders';

jest.mock('../../../../src/main/shared/user_data_location', () => ({
	userDataLocation: () => '/data/.kucedr',
}));

it('opens folder selection in the application data directory', async () => {
	const owner = { id: 1 };
	const options = {
		defaultPath: '/data/.kucedr',
		properties: ['openDirectory', 'multiSelections'],
	};
	(BrowserWindow.getFocusedWindow as jest.Mock).mockReturnValueOnce(owner);
	(dialog.showOpenDialog as jest.Mock).mockResolvedValueOnce({
		canceled: false,
		filePaths: ['/data/.kucedr/workspace'],
	});

	await expect(pickFolders()).resolves.toEqual(['/data/.kucedr/workspace']);
	expect(dialog.showOpenDialog).toHaveBeenLastCalledWith(owner, options);

	await expect(pickFolders()).resolves.toEqual([]);
	expect(dialog.showOpenDialog).toHaveBeenLastCalledWith(options);
});
