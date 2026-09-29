import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LibraryPage from '../../../src/renderer/src/pages/settings/pages/library/Page';

jest.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string): string => key }),
}));

const list = jest.fn();
const getRoot = jest.fn();
const openRoot = jest.fn();
const add = jest.fn();
const select = jest.fn();

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
	Object.defineProperty(window, 'library', {
		configurable: true,
		value: { list, getRoot, openRoot, add, select },
	});
	Object.defineProperty(window, 'app', {
		configurable: true,
		value: { getPathForFile: (file: File) => `/tmp/${file.name}` },
	});
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
	const { container } = render(<LibraryPage />);
	await screen.findByText('notes.txt');
	const dropTarget = container.querySelector('.contents');
	const file = new File(['draft'], 'draft.md', { type: 'text/markdown' });

	fireEvent.drop(dropTarget as HTMLElement, { dataTransfer: { files: [file] } });

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
