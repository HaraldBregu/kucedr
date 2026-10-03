import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { WorkspaceFiles } from '../../../src/renderer/src/pages/code/Files';

jest.mock('react-i18next', () => {
	const t = (key: string, fallback: string): string => fallback ?? key;
	return { useTranslation: () => ({ t }) };
});

const listMarkdownFiles = jest.fn();
const createMarkdownFile = jest.fn();

beforeEach(() => {
	jest.clearAllMocks();
	listMarkdownFiles.mockResolvedValue([]);
	createMarkdownFile.mockResolvedValue(undefined);
	Object.defineProperty(window, 'coder', { configurable: true, value: { listMarkdownFiles, createMarkdownFile } });
});

it('creates Markdown within the selected workspace and opens it', async () => {
	const onOpen = jest.fn();
	render(<WorkspaceFiles projectId="workspace-a" selectedFile={null} creation="markdown" onCancelCreation={jest.fn()} onOpen={onOpen} />);
	await screen.findByText('No files yet.');
	fireEvent.change(screen.getByLabelText('File name'), { target: { value: 'notes' } });
	fireEvent.click(screen.getByRole('button', { name: 'Create' }));
	await waitFor(() => expect(onOpen).toHaveBeenCalledWith('notes.md'));
	expect(createMarkdownFile).toHaveBeenCalledWith('workspace-a', 'notes.md');
});

it('creates the recognized instructions filename and opens existing instructions without overwriting them', async () => {
	const onOpen = jest.fn();
	const view = render(<WorkspaceFiles projectId="workspace-b" selectedFile={null} creation="instructions" onCancelCreation={jest.fn()} onOpen={onOpen} />);
	await screen.findByText('No files yet.');
	expect(screen.getByLabelText('File name')).toHaveValue('AGENTS.md');
	listMarkdownFiles.mockResolvedValue(['AGENTS.md']);
	fireEvent.click(screen.getByRole('button', { name: 'Create' }));
	await waitFor(() => expect(onOpen).toHaveBeenCalledWith('AGENTS.md'));
	await screen.findByRole('button', { name: 'AGENTS.md' });
	view.rerender(<WorkspaceFiles projectId="workspace-b" selectedFile="AGENTS.md" creation="instructions" onCancelCreation={jest.fn()} onOpen={onOpen} />);
	expect(screen.getByRole('button', { name: 'AGENTS.md' })).toHaveAttribute('aria-current', 'page');
	fireEvent.click(screen.getByRole('button', { name: 'Create' }));
	expect(createMarkdownFile).toHaveBeenCalledTimes(1);
});

it('keeps the filename and shows a creation failure without opening a file', async () => {
	createMarkdownFile.mockRejectedValue(new Error('File already exists'));
	const onOpen = jest.fn();
	render(<WorkspaceFiles projectId="workspace-c" selectedFile={null} creation="markdown" onCancelCreation={jest.fn()} onOpen={onOpen} />);
	await screen.findByText('No files yet.');
	fireEvent.change(screen.getByLabelText('File name'), { target: { value: 'notes.md' } });
	fireEvent.click(screen.getByRole('button', { name: 'Create' }));
	expect(await screen.findByRole('alert')).toHaveTextContent('File already exists');
	expect(screen.getByLabelText('File name')).toHaveValue('notes.md');
	expect(onOpen).not.toHaveBeenCalled();
});
