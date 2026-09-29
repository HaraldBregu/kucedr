import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LibraryPage from '../../../src/renderer/src/pages/settings/pages/library/Page';

jest.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string): string => key }),
}));

const list = jest.fn();
const getRoot = jest.fn();
const openRoot = jest.fn();

beforeEach(() => {
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
	Object.defineProperty(window, 'library', {
		configurable: true,
		value: { list, getRoot, openRoot },
	});
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
