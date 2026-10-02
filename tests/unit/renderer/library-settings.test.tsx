import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
const showContextMenu = jest.fn();
const manyFiles = Array.from({ length: 50 }, (_, index) => {
	const name = `file-${String(index).padStart(3, '0')}.png`;
	return { name, path: `/library/${name}`, relativePath: name, size: 10, modifiedAt: '2026-09-29T10:00:00.000Z' };
});

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
	showContextMenu.mockResolvedValue(null);
	Object.defineProperty(window, 'library', {
		configurable: true,
		value: { list, getRoot, openRoot, add, select, delete: deleteFile },
	});
	Object.defineProperty(window, 'app', {
		configurable: true,
		value: { getPathForFile: (file: File) => `/tmp/${file.name}` },
	});
	Object.defineProperty(window, 'win', { configurable: true, value: { showContextMenu } });
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
	await user.click(screen.getAllByRole('button', { name: 'settings.library.previewFile' })[0]);
	expect(
		within(screen.getByRole('dialog')).getByRole('img', { name: 'photo.png' })
	).toBeInTheDocument();
	await user.keyboard('{Escape}');
	await user.click(screen.getByRole('button', { name: 'settings.library.list' }));
	expect(screen.getByRole('img', { name: 'photo.png' })).toBeInTheDocument();
	const song = screen.getAllByRole('button', { name: 'settings.library.previewFile' })[1];
	await user.click(song);
	expect(within(screen.getByRole('dialog')).getByLabelText('song.mp3').tagName).toBe('AUDIO');
	expect(within(screen.getByRole('dialog')).getByLabelText('song.mp3')).toHaveAttribute('controls');
	fireEvent.keyDown(within(screen.getByRole('dialog')).getByLabelText('song.mp3'), {
		key: 'ArrowRight',
	});
	expect(within(screen.getByRole('dialog')).getByLabelText('song.mp3')).toBeInTheDocument();
	await user.keyboard('{Escape}');
	await user.click(screen.getAllByRole('button', { name: 'settings.library.previewFile' })[2]);
	expect(within(screen.getByRole('dialog')).getByLabelText('movie.mp4').tagName).toBe('VIDEO');
	expect(within(screen.getByRole('dialog')).getByLabelText('movie.mp4')).toHaveAttribute(
		'controls'
	);
});

it('opens the native file context menu and handles preview and delete', async () => {
	const user = userEvent.setup();
	render(<LibraryPage />);
	const card = (await screen.findByText('notes.txt')).closest('article')!;
	showContextMenu.mockResolvedValueOnce('preview').mockResolvedValueOnce('delete');
	fireEvent.contextMenu(card);
	await screen.findByRole('dialog');
	expect(showContextMenu).toHaveBeenCalledWith(
		expect.arrayContaining([
			expect.objectContaining({ id: 'preview' }),
			expect.objectContaining({ id: 'delete' }),
		])
	);
	await user.keyboard('{Escape}');
	fireEvent.contextMenu(card);
	await waitFor(() => expect(deleteFile).toHaveBeenCalledWith('documents/notes.txt'));
});

it('opens the native context menu from a list row', async () => {
	const user = userEvent.setup();
	render(<LibraryPage />);
	await user.click(await screen.findByRole('button', { name: 'settings.library.list' }));
	fireEvent.contextMenu(screen.getByText('notes.txt').closest('[data-slot="item"]')!);
	await waitFor(() => expect(showContextMenu).toHaveBeenCalledTimes(1));
});

it('navigates the preview with buttons and arrow keys without wrapping', async () => {
	list.mockResolvedValue(
		['first.png', 'second.png', 'third.png'].map((name) => ({
			name,
			path: `/library/${name}`,
			relativePath: name,
			size: 10,
			modifiedAt: '2026-09-29T10:00:00.000Z',
		}))
	);
	const user = userEvent.setup();
	render(<LibraryPage />);
	await user.click(
		(await screen.findAllByRole('button', { name: 'settings.library.previewFile' }))[0]
	);
	const dialog = screen.getByRole('dialog');
	expect(within(dialog).getByText('1 / 3')).toBeInTheDocument();
	expect(within(dialog).getByRole('button', { name: 'settings.library.previous' })).toBeDisabled();
	await user.click(within(dialog).getByRole('button', { name: 'settings.library.next' }));
	expect(within(dialog).getByRole('img', { name: 'second.png' })).toBeInTheDocument();
	fireEvent.keyDown(dialog, { key: 'ArrowRight' });
	expect(within(dialog).getByRole('img', { name: 'third.png' })).toBeInTheDocument();
	expect(within(dialog).getByRole('button', { name: 'settings.library.next' })).toBeDisabled();
	fireEvent.keyDown(dialog, { key: 'ArrowRight' });
	expect(within(dialog).getByText('3 / 3')).toBeInTheDocument();
	fireEvent.keyDown(dialog, { key: 'ArrowLeft' });
	expect(within(dialog).getByRole('img', { name: 'second.png' })).toBeInTheDocument();
});

it('limits both views to 48 files and loads the next batch on demand', async () => {
	list.mockResolvedValue(manyFiles);
	const user = userEvent.setup();
	render(<LibraryPage />);
	await screen.findByText('file-000.png');
	expect(document.querySelectorAll('article')).toHaveLength(48);
	expect(screen.queryByText('file-048.png')).not.toBeInTheDocument();
	await user.click(screen.getByRole('button', { name: 'settings.library.list' }));
	expect(document.querySelectorAll('[data-slot="item"]')).toHaveLength(48);
	await user.click(screen.getByRole('button', { name: 'settings.library.loadMore' }));
	expect(await screen.findByText('file-049.png')).toBeInTheDocument();
	expect(document.querySelectorAll('[data-slot="item"]')).toHaveLength(50);
	expect(screen.queryByRole('button', { name: 'settings.library.loadMore' })).not.toBeInTheDocument();
});

it('loads the next batch when the end of the visible files enters the viewport', async () => {
	list.mockResolvedValue(manyFiles);
	const originalObserver = globalThis.IntersectionObserver;
	let notifyIntersection: IntersectionObserverCallback | undefined;
	const observe = jest.fn();
	const disconnect = jest.fn();
	globalThis.IntersectionObserver = class {
		constructor(callback: IntersectionObserverCallback) { notifyIntersection = callback; }
		observe = observe;
		disconnect = disconnect;
	} as unknown as typeof IntersectionObserver;
	try {
		const { unmount } = render(<LibraryPage />);
		await screen.findByText('file-000.png');
		expect(document.querySelectorAll('article')).toHaveLength(48);
		expect(observe).toHaveBeenCalledTimes(1);
		act(() => notifyIntersection?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
		await waitFor(() => expect(document.querySelectorAll('article')).toHaveLength(50));
		expect(disconnect).toHaveBeenCalled();
		unmount();
	} finally {
		globalThis.IntersectionObserver = originalObserver;
	}
});
