import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LibraryPage from '../../../src/renderer/src/pages/settings/pages/library/Page';

const mockTranslate = (key: string): string => key;
const mockNavigate = jest.fn();
const mockSetSessionId = jest.fn();

jest.mock('react-router-dom', () => ({
	...jest.requireActual('react-router-dom'),
	useNavigate: () => mockNavigate,
}));
jest.mock('../../../src/renderer/src/contexts/chat-session', () => ({
	useChatSession: () => ({ setSessionId: mockSetSessionId }),
}));

jest.mock('react-i18next', () => ({
	useTranslation: () => ({ t: mockTranslate }),
}));

const list = jest.fn();
const getRoot = jest.fn();
const openRoot = jest.fn();
const add = jest.fn();
const select = jest.fn();
const deleteFile = jest.fn();
const createFolder = jest.fn();
const download = jest.fn();
const move = jest.fn();
const showContextMenu = jest.fn();
const manyFiles = Array.from({ length: 50 }, (_, index) => {
	const name = `file-${String(index).padStart(3, '0')}.png`;
	return {
		name,
		path: `/library/${name}`,
		relativePath: name,
		size: 10,
		modifiedAt: '2026-09-29T10:00:00.000Z',
	};
});

beforeEach(() => {
	jest.clearAllMocks();
	localStorage.clear();
	list.mockResolvedValue([
		{
			name: 'notes.txt',
			path: '/Users/example/.kucedr/library/notes.txt',
			relativePath: 'notes.txt',
			size: 1536,
			modifiedAt: '2026-09-29T10:00:00.000Z',
		},
	]);
	getRoot.mockResolvedValue('/Users/example/.kucedr/library');
	openRoot.mockResolvedValue(undefined);
	add.mockResolvedValue([]);
	select.mockResolvedValue([]);
	deleteFile.mockResolvedValue(undefined);
	createFolder.mockResolvedValue(undefined);
	download.mockResolvedValue(true);
	move.mockResolvedValue(undefined);
	showContextMenu.mockResolvedValue(null);
	Object.defineProperty(window, 'library', {
		configurable: true,
		value: {
			list,
			getRoot,
			openRoot,
			add,
			select,
			delete: deleteFile,
			createFolder,
			download,
			move,
		},
	});
	Object.defineProperty(window, 'app', {
		configurable: true,
		value: { getPathForFile: (file: File) => `/tmp/${file.name}` },
	});
	Object.defineProperty(window, 'win', { configurable: true, value: { showContextMenu } });
	window.confirm = jest.fn(() => true);
});

it('shows the view controls and file actions in the header with list selected by default', async () => {
	const { container } = render(<LibraryPage />);
	await screen.findByText('notes.txt');

	const header = container.querySelector('header')!;
	expect(
		within(header)
			.getAllByRole('button')
			.map((button) => button.getAttribute('aria-label') ?? button.textContent)
	).toEqual([
		'settings.library.collections',
		'settings.library.list',
		'settings.library.createFolder',
		'settings.library.openFolder',
		'settings.library.upload',
	]);
	expect(screen.getByRole('table')).toBeInTheDocument();
	expect(screen.getAllByRole('row')).toHaveLength(2);
	expect(
		screen.queryByRole('columnheader', { name: 'settings.library.path' })
	).not.toBeInTheDocument();
	expect(
		screen.queryByRole('columnheader', { name: 'settings.library.actions' })
	).not.toBeInTheDocument();
	expect(document.querySelectorAll('article')).toHaveLength(0);
	for (const button of within(header).getAllByRole('button')) {
		expect(button).toHaveClass('bg-secondary');
		expect(button).not.toHaveClass('border-input');
	}
	const selectAll = screen.getByRole('checkbox', { name: 'settings.library.select' });
	const checkbox = screen.getByRole('checkbox', { name: 'settings.library.selectFile' });
	expect(checkbox).not.toHaveClass('opacity-0');
	await userEvent.setup().click(checkbox);
	expect(checkbox).toHaveAttribute('data-state', 'checked');
	expect(
		screen.getByRole('toolbar', { name: 'settings.library.selectionActions' })
	).toBeInTheDocument();
	expect(selectAll).toHaveAttribute('data-state', 'checked');
	await userEvent.setup().click(selectAll);
	expect(checkbox).toHaveAttribute('data-state', 'unchecked');

	await userEvent
		.setup()
		.click(within(header).getByRole('button', { name: 'settings.library.collections' }));
	expect(document.querySelectorAll('article')).toHaveLength(1);
});

it('shows an indeterminate select-all checkbox for a partial table selection', async () => {
	list.mockResolvedValue([manyFiles[0], manyFiles[1]]);
	const user = userEvent.setup();
	render(<LibraryPage />);
	const checkboxes = await screen.findAllByRole('checkbox');
	await user.click(checkboxes[1]);
	expect(checkboxes[0]).toHaveAttribute('data-state', 'indeterminate');
	await user.click(checkboxes[0]);
	expect(checkboxes[1]).toHaveAttribute('data-state', 'checked');
	expect(checkboxes[2]).toHaveAttribute('data-state', 'checked');
});

it('shows only the opened folder contents and navigates back to the library root', async () => {
	list.mockResolvedValue([
		{
			kind: 'folder',
			name: 'Projects',
			path: '/library/Projects',
			relativePath: 'Projects',
			size: 0,
			modifiedAt: '2026-09-29',
		},
		{
			name: 'notes.txt',
			path: '/library/Projects/notes.txt',
			relativePath: 'Projects/notes.txt',
			size: 5,
			modifiedAt: '2026-09-29',
		},
		{
			kind: 'folder',
			name: 'Nested',
			path: '/library/Projects/Nested',
			relativePath: 'Projects/Nested',
			size: 0,
			modifiedAt: '2026-09-29',
		},
		{
			name: 'deep.txt',
			path: '/library/Projects/Nested/deep.txt',
			relativePath: 'Projects/Nested/deep.txt',
			size: 5,
			modifiedAt: '2026-09-29',
		},
	]);
	const user = userEvent.setup();
	render(<LibraryPage />);
	const projects = await screen.findByRole('row', { name: /Projects/ });
	expect(screen.queryByText('notes.txt')).not.toBeInTheDocument();
	await user.click(
		within(projects).getByRole('button', { name: 'settings.library.openFolderNamed' })
	);
	expect(await screen.findByText('notes.txt')).toBeInTheDocument();
	expect(screen.queryByText('deep.txt')).not.toBeInTheDocument();
	await user.click(
		within(screen.getByRole('row', { name: /Nested/ })).getByRole('button', {
			name: 'settings.library.openFolderNamed',
		})
	);
	expect(await screen.findByText('deep.txt')).toBeInTheDocument();
	await user.click(
		within(screen.getByRole('navigation', { name: 'settings.library.folderNavigation' })).getByRole(
			'button',
			{ name: 'library.title' }
		)
	);
	expect(screen.queryByText('deep.txt')).not.toBeInTheDocument();
	expect(screen.getByRole('row', { name: /Projects/ })).toBeInTheDocument();
});

it('drags selected files onto a folder in the list without uploading them again', async () => {
	list.mockResolvedValue([
		{
			kind: 'folder',
			name: 'Projects',
			path: '/library/Projects',
			relativePath: 'Projects',
			size: 0,
			modifiedAt: '2026-09-29',
		},
		manyFiles[0],
		manyFiles[1],
	]);
	const user = userEvent.setup();
	render(<LibraryPage />);
	await screen.findByText('Projects');
	await user.click(screen.getByRole('checkbox', { name: 'settings.library.select' }));
	const transferData = new Map<string, string>();
	const dataTransfer = {
		types: ['application/x-kucedr-library-items'],
		files: [],
		setData: (type: string, value: string) => transferData.set(type, value),
		getData: (type: string) => transferData.get(type) ?? '',
		effectAllowed: 'none',
		dropEffect: 'none',
	};
	fireEvent.dragStart(screen.getByText('file-000.png').closest('tr')!, { dataTransfer });
	const folderRow = screen.getByText('Projects').closest('tr')!;
	fireEvent.dragOver(folderRow, { dataTransfer });
	expect(folderRow).toHaveAttribute('data-drop-target', 'true');
	fireEvent.drop(folderRow, { dataTransfer });
	await waitFor(() =>
		expect(move).toHaveBeenCalledWith(['file-000.png', 'file-001.png'], 'Projects')
	);
	expect(add).not.toHaveBeenCalled();
});

it('drags one folder into another in the collections view', async () => {
	list.mockResolvedValue([
		{
			kind: 'folder',
			name: 'Projects',
			path: '/library/Projects',
			relativePath: 'Projects',
			size: 0,
			modifiedAt: '2026-09-29',
		},
		{
			kind: 'folder',
			name: 'Archive',
			path: '/library/Archive',
			relativePath: 'Archive',
			size: 0,
			modifiedAt: '2026-09-29',
		},
	]);
	const user = userEvent.setup();
	render(<LibraryPage />);
	await screen.findByText('Projects');
	await user.click(screen.getByRole('button', { name: 'settings.library.collections' }));
	const transferData = new Map<string, string>();
	const dataTransfer = {
		types: ['application/x-kucedr-library-items'],
		files: [],
		setData: (type: string, value: string) => transferData.set(type, value),
		getData: (type: string) => transferData.get(type) ?? '',
		effectAllowed: 'none',
		dropEffect: 'none',
	};
	fireEvent.dragStart(screen.getAllByText('Projects')[0].closest('article')!, { dataTransfer });
	fireEvent.drop(screen.getAllByText('Archive')[0].closest('article')!, { dataTransfer });
	await waitFor(() => expect(move).toHaveBeenCalledWith(['Projects'], 'Archive'));
});

it('creates a folder from the icon-only header', async () => {
	const user = userEvent.setup();
	render(<LibraryPage />);
	await screen.findByText('notes.txt');
	await user.click(screen.getByRole('button', { name: 'settings.library.createFolder' }));
	await user.type(screen.getByRole('textbox', { name: 'settings.library.folderName' }), 'Projects');
	await user.click(
		within(screen.getByRole('dialog')).getByRole('button', {
			name: 'settings.library.createFolder',
		})
	);
	await waitFor(() => expect(createFolder).toHaveBeenCalledWith('Projects'));
});

it('shows selection actions and downloads or deletes selected files', async () => {
	const user = userEvent.setup();
	render(<LibraryPage />);
	await screen.findByText('notes.txt');
	await user.click(screen.getByRole('checkbox', { name: 'settings.library.selectFile' }));
	const toolbar = screen.getByRole('toolbar', { name: 'settings.library.selectionActions' });
	await user.click(within(toolbar).getByRole('button', { name: 'settings.library.download' }));
	await waitFor(() => expect(download).toHaveBeenCalledWith(['notes.txt']));
	await user.click(
		within(toolbar).getByRole('button', { name: 'settings.library.deleteSelected' })
	);
	await waitFor(() => expect(deleteFile).toHaveBeenCalledWith('notes.txt'));
	expect(
		screen.queryByRole('toolbar', { name: 'settings.library.selectionActions' })
	).not.toBeInTheDocument();
});

it('starts a new chat with the selected file attached', async () => {
	const user = userEvent.setup();
	render(<LibraryPage />);
	await screen.findByText('notes.txt');
	await user.click(screen.getByRole('checkbox', { name: 'settings.library.selectFile' }));
	await user.click(screen.getByRole('button', { name: 'settings.library.startChat' }));
	expect(mockSetSessionId).toHaveBeenCalledWith(expect.any(String));
	expect(mockNavigate).toHaveBeenCalledWith('/home');
	const drafts = JSON.parse(localStorage.getItem('kucedr-prompt-attachments')!);
	expect(drafts[mockSetSessionId.mock.calls[0][0]]).toEqual([
		expect.objectContaining({
			name: 'notes.txt',
			path: '/Users/example/.kucedr/library/notes.txt',
		}),
	]);
});

it('confirms and deletes a library file', async () => {
	const user = userEvent.setup();
	render(<LibraryPage />);
	await user.click(screen.getByRole('button', { name: 'settings.library.collections' }));

	const deleteButton = await screen.findByRole('button', { name: 'settings.library.delete' });
	await user.click(deleteButton);

	expect(window.confirm).toHaveBeenCalledWith('settings.library.confirmDelete');
	await waitFor(() => expect(deleteFile).toHaveBeenCalledWith('notes.txt'));
	expect(screen.queryByText('notes.txt')).not.toBeInTheDocument();
});

it('keeps the file when deletion is cancelled', async () => {
	window.confirm = jest.fn(() => false);
	const user = userEvent.setup();
	render(<LibraryPage />);
	await user.click(screen.getByRole('button', { name: 'settings.library.collections' }));

	await user.click(await screen.findByRole('button', { name: 'settings.library.delete' }));

	expect(deleteFile).not.toHaveBeenCalled();
	expect(screen.getAllByText('notes.txt')[0]).toBeInTheDocument();
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

	fireEvent.drop(dropTarget, { dataTransfer: { types: ['Files'], files: [file] } });

	await waitFor(() => expect(add).toHaveBeenCalledWith(['/tmp/draft.md']));
	expect(list).toHaveBeenCalledTimes(2);
});

it('loads library files and opens the library folder', async () => {
	const user = userEvent.setup();
	render(<LibraryPage />);

	expect(await screen.findByText('notes.txt')).toBeInTheDocument();
	expect(screen.getByRole('columnheader', { name: 'settings.library.name' })).toBeInTheDocument();
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
	await user.click(screen.getByRole('button', { name: 'settings.library.collections' }));

	expect(await screen.findByRole('img', { name: 'photo.png' })).toHaveAttribute(
		'src',
		'local-resource://file/library/photo.png'
	);
	expect(
		screen.queryByRole('button', { name: 'settings.library.previewFile' })
	).not.toBeInTheDocument();
	showContextMenu.mockResolvedValueOnce('preview');
	fireEvent.contextMenu(screen.getAllByText('photo.png')[0].closest('article')!);
	expect(
		await within(await screen.findByRole('dialog')).findByRole('img', { name: 'photo.png' })
	).toBeInTheDocument();
	await user.keyboard('{Escape}');
	await user.click(screen.getByRole('button', { name: 'settings.library.list' }));
	expect(screen.getByRole('img', { name: 'photo.png' })).toHaveClass('size-8', 'object-cover');
	showContextMenu.mockResolvedValueOnce('preview');
	fireEvent.contextMenu(screen.getByText('song.mp3').closest('tr')!);
	await screen.findByRole('dialog');
	expect(within(screen.getByRole('dialog')).getByLabelText('song.mp3').tagName).toBe('AUDIO');
	expect(within(screen.getByRole('dialog')).getByLabelText('song.mp3')).toHaveAttribute('controls');
	fireEvent.keyDown(within(screen.getByRole('dialog')).getByLabelText('song.mp3'), {
		key: 'ArrowRight',
	});
	expect(within(screen.getByRole('dialog')).getByLabelText('song.mp3')).toBeInTheDocument();
	await user.keyboard('{Escape}');
	showContextMenu.mockResolvedValueOnce('preview');
	fireEvent.contextMenu(screen.getByText('movie.mp4').closest('tr')!);
	await screen.findByRole('dialog');
	expect(within(screen.getByRole('dialog')).getByLabelText('movie.mp4').tagName).toBe('VIDEO');
	expect(within(screen.getByRole('dialog')).getByLabelText('movie.mp4')).toHaveAttribute(
		'controls'
	);
});

it('opens the native file context menu and handles preview and delete', async () => {
	const user = userEvent.setup();
	render(<LibraryPage />);
	await user.click(screen.getByRole('button', { name: 'settings.library.collections' }));
	const card = (await screen.findAllByText('notes.txt'))[0].closest('article')!;
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
	await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
	fireEvent.contextMenu(card);
	await waitFor(() => expect(deleteFile).toHaveBeenCalledWith('notes.txt'));
});

it('opens the native context menu from a list row', async () => {
	const user = userEvent.setup();
	render(<LibraryPage />);
	await user.click(await screen.findByRole('button', { name: 'settings.library.list' }));
	fireEvent.contextMenu(screen.getByText('notes.txt').closest('tr')!);
	await waitFor(() => expect(showContextMenu).toHaveBeenCalledTimes(1));
});

it('sorts table columns in both directions', async () => {
	list.mockResolvedValue([
		{
			...manyFiles[0],
			name: 'charlie.png',
			relativePath: 'charlie.png',
			size: 20,
			modifiedAt: '2026-09-29T10:00:00.000Z',
		},
		{
			...manyFiles[1],
			name: 'alpha.png',
			relativePath: 'alpha.png',
			size: 30,
			modifiedAt: '2026-09-27T10:00:00.000Z',
		},
		{
			...manyFiles[2],
			name: 'bravo.png',
			relativePath: 'bravo.png',
			size: 10,
			modifiedAt: '2026-09-28T10:00:00.000Z',
		},
	]);
	const user = userEvent.setup();
	render(<LibraryPage />);
	await screen.findByText('alpha.png');

	const names = () =>
		screen
			.getAllByRole('row')
			.slice(1)
			.map((row) => row.querySelectorAll('td')[1]?.textContent);
	expect(names()).toEqual(['alpha.png', 'bravo.png', 'charlie.png']);
	const sizeHeader = screen.getByRole('columnheader', { name: 'settings.library.size' });
	await user.click(within(sizeHeader).getByRole('button'));
	expect(sizeHeader).toHaveAttribute('aria-sort', 'ascending');
	expect(names()).toEqual(['bravo.png', 'charlie.png', 'alpha.png']);
	await user.click(within(sizeHeader).getByRole('button'));
	expect(sizeHeader).toHaveAttribute('aria-sort', 'descending');
	expect(names()).toEqual(['alpha.png', 'charlie.png', 'bravo.png']);
	await user.click(screen.getByRole('button', { name: 'settings.library.modified' }));
	expect(names()).toEqual(['alpha.png', 'bravo.png', 'charlie.png']);
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
	await screen.findByText('first.png');
	showContextMenu.mockResolvedValueOnce('preview');
	fireEvent.contextMenu(screen.getByText('first.png').closest('tr')!);
	await screen.findByRole('dialog');
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
	await screen.findAllByText('file-000.png');
	expect(screen.getAllByRole('row')).toHaveLength(49);
	await user.click(screen.getByRole('button', { name: 'settings.library.collections' }));
	expect(document.querySelectorAll('article')).toHaveLength(48);
	expect(screen.queryByText('file-048.png')).not.toBeInTheDocument();
	await user.click(screen.getByRole('button', { name: 'settings.library.list' }));
	expect(screen.getAllByRole('row')).toHaveLength(49);
	await user.click(screen.getByRole('button', { name: 'settings.library.loadMore' }));
	expect(await screen.findAllByText('file-049.png')).toHaveLength(1);
	expect(screen.getAllByRole('row')).toHaveLength(51);
	expect(
		screen.queryByRole('button', { name: 'settings.library.loadMore' })
	).not.toBeInTheDocument();
});

it('loads the next batch when the end of the visible files enters the viewport', async () => {
	list.mockResolvedValue(manyFiles);
	const originalObserver = globalThis.IntersectionObserver;
	let notifyIntersection: IntersectionObserverCallback | undefined;
	const observe = jest.fn();
	const disconnect = jest.fn();
	globalThis.IntersectionObserver = class {
		constructor(callback: IntersectionObserverCallback) {
			notifyIntersection = callback;
		}
		observe = observe;
		disconnect = disconnect;
	} as unknown as typeof IntersectionObserver;
	try {
		const { unmount } = render(<LibraryPage />);
		await screen.findAllByText('file-000.png');
		expect(screen.getAllByRole('row')).toHaveLength(49);
		expect(observe).toHaveBeenCalledTimes(1);
		act(() =>
			notifyIntersection?.(
				[{ isIntersecting: true } as IntersectionObserverEntry],
				{} as IntersectionObserver
			)
		);
		await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(51));
		expect(disconnect).toHaveBeenCalled();
		unmount();
	} finally {
		globalThis.IntersectionObserver = originalObserver;
	}
});
