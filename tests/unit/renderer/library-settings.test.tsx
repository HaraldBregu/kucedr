import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LibraryPage from '../../../src/renderer/src/pages/settings/pages/library/Page';

const mockTranslate = (key: string): string => key;

jest.mock('react-i18next', () => ({
	useTranslation: () => ({ t: mockTranslate }),
}));

const list = jest.fn();
const getRoot = jest.fn();
const openRoot = jest.fn();
const add = jest.fn();
const select = jest.fn();
const deleteFile = jest.fn();

beforeEach(() => {
	jest.clearAllMocks();
	list.mockResolvedValue([
		{
			name: 'notes.txt',
			path: '/Users/example/.kucedr/library/documents/notes.txt',
			relativePath: 'documents/notes.txt',
			size: 1536,
			modifiedAt: '2026-09-29T10:00:00.000Z',
		},
	]);
	getRoot.mockResolvedValue('/Users/example/.kucedr/library');
	openRoot.mockResolvedValue(undefined);
	add.mockResolvedValue([]);
	select.mockResolvedValue([]);
	deleteFile.mockResolvedValue(undefined);
	Object.defineProperty(window, 'library', {
		configurable: true,
		value: { list, getRoot, openRoot, add, select, delete: deleteFile },
	});
	Object.defineProperty(window, 'app', {
		configurable: true,
		value: { getPathForFile: (file: File) => `/tmp/${file.name}` },
	});
	window.confirm = jest.fn(() => true);
});

it('confirms and deletes a library file', async () => {
	const user = userEvent.setup();
	render(<LibraryPage />);
	await user.click(await screen.findByRole('button', { name: 'settings.library.list' }));

	const deleteButton = await screen.findByRole('button', { name: 'settings.library.delete' });
	const row = deleteButton.closest('[data-slot="item"]');
	const actions = deleteButton.closest('[data-slot="item-actions"]');
	expect(actions).toBe(row?.lastElementChild);
	expect(actions).toHaveClass('flex-none', 'justify-end');
	await user.click(deleteButton);

	expect(window.confirm).toHaveBeenCalledWith('settings.library.confirmDelete');
	await waitFor(() => expect(deleteFile).toHaveBeenCalledWith('documents/notes.txt'));
	expect(screen.queryByText('notes.txt')).not.toBeInTheDocument();
});

it('keeps the file when deletion is cancelled', async () => {
	window.confirm = jest.fn(() => false);
	const user = userEvent.setup();
	render(<LibraryPage />);

	await user.click(await screen.findByRole('button', { name: 'settings.library.delete' }));

	expect(deleteFile).not.toHaveBeenCalled();
	expect(screen.getByText('notes.txt')).toBeInTheDocument();
});

it('uploads selected files and reloads the list', async () => {
	const user = userEvent.setup();
	render(<LibraryPage />);

	await screen.findByText('notes.txt');
	await user.click(screen.getByRole('button', { name: 'settings.library.upload' }));

	await waitFor(() => expect(select).toHaveBeenCalledTimes(1));
	expect(list).toHaveBeenCalledTimes(2);
	expect(
		screen.queryByRole('button', { name: 'settings.library.refresh' })
	).not.toBeInTheDocument();
});

it('uploads dropped files and reloads the list', async () => {
	render(<LibraryPage />);
	await screen.findByText('notes.txt');
	const dropTarget = screen.getByRole('region', { name: 'settings.library.dropZone' });
	const file = new File(['draft'], 'draft.md', { type: 'text/markdown' });

	fireEvent.drop(dropTarget, { dataTransfer: { files: [file] } });

	await waitFor(() => expect(add).toHaveBeenCalledWith(['/tmp/draft.md']));
	expect(list).toHaveBeenCalledTimes(2);
});

it('loads library files and opens the library folder', async () => {
	const user = userEvent.setup();
	render(<LibraryPage />);

	expect(await screen.findByText('notes.txt')).toBeInTheDocument();
	expect(screen.getByText('documents/notes.txt')).toBeInTheDocument();
	expect(screen.getByText('1.5 KB')).toBeInTheDocument();
	expect(screen.getByText('/Users/example/.kucedr/library')).toBeInTheDocument();

	await user.click(screen.getByRole('button', { name: 'settings.library.openFolder' }));
	await waitFor(() => expect(openRoot).toHaveBeenCalledTimes(1));
});

it('shows an empty state when the library has no files', async () => {
	list.mockResolvedValue([]);
	render(<LibraryPage />);

	expect(await screen.findByText('library.empty')).toBeInTheDocument();
});

it('shows media previews in both library views', async () => {
	list.mockResolvedValue([
		{
			name: 'photo.png',
			path: '/library/photo.png',
			relativePath: 'photo.png',
			size: 10,
			modifiedAt: '2026-09-29T10:00:00.000Z',
		},
		{
			name: 'song.mp3',
			path: '/library/song.mp3',
			relativePath: 'song.mp3',
			size: 10,
			modifiedAt: '2026-09-29T10:00:00.000Z',
		},
		{
			name: 'movie.mp4',
			path: '/library/movie.mp4',
			relativePath: 'movie.mp4',
			size: 10,
			modifiedAt: '2026-09-29T10:00:00.000Z',
		},
	]);
	const user = userEvent.setup();
	render(<LibraryPage />);

	expect(await screen.findByRole('img', { name: 'photo.png' })).toHaveAttribute(
		'src',
		'local-resource://file/library/photo.png'
	);
	expect(screen.getByLabelText('song.mp3').tagName).toBe('AUDIO');
	expect(screen.getByLabelText('movie.mp4').tagName).toBe('VIDEO');
	await user.click(screen.getByRole('button', { name: 'settings.library.list' }));
	expect(screen.getByRole('img', { name: 'photo.png' })).toBeInTheDocument();
	expect(screen.getByLabelText('song.mp3')).toBeInTheDocument();
});
