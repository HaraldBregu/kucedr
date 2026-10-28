import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ChatWorkspace } from '../../../src/renderer/src/pages/home/Workspace';
import { attachmentPath } from '../../../src/renderer/src/pages/home/attachments/path';

const file = { type: 'file', name: 'notes.md', path: 'Projects/notes.md' };
let onChanged: (event: { type: string }) => void;
const unsubscribe = jest.fn();
const onAttach = jest.fn();

beforeEach(() => {
	localStorage.clear();
	Object.defineProperty(window, 'agent', { configurable: true, value: {
		getWorkspaceLocation: jest.fn().mockResolvedValue('/workspace/'),
		readPromptFile: jest.fn().mockResolvedValue(new Uint8Array([104, 101, 108, 108, 111])),
		listWorkspaceFiles: jest.fn().mockResolvedValue([{ type: 'directory', name: 'Projects', path: 'Projects', children: [file] }]),
		onWorkspaceChanged: jest.fn().mockImplementation((callback) => { onChanged = callback; return unsubscribe; }),
	} });
});

it('selects nested workspace files as chat attachments without navigating', async () => {
	render(<ChatWorkspace onAttach={onAttach} />);
	expect(screen.getByRole('button', { name: /^Workspace/ })).toHaveAttribute('aria-expanded', 'false');
	fireEvent.click(screen.getByRole('button', { name: /^Workspace/ }));
	fireEvent.click(await screen.findByRole('button', { name: 'Attach Projects/notes.md' }));
	await waitFor(() => expect(onAttach).toHaveBeenCalledTimes(1));
	const attachment = onAttach.mock.calls[0][0][0] as File;
	expect(attachment).toBeInstanceOf(File);
	expect(attachment.name).toBe('notes.md');
	expect(attachment.size).toBe(5);
	expect(attachment.type).toBe('text/markdown');
	expect(attachmentPath(attachment)).toBe('/workspace/Projects/notes.md');
	expect(window.agent.readPromptFile).toHaveBeenCalledWith('/workspace/Projects/notes.md');
	expect(localStorage.getItem('workspace-selected-file')).toBeNull();
	expect(screen.getByRole('button', { name: /^Workspace/ })).toBeInTheDocument();
});

it('refreshes after workspace changes and cleans up its subscription', async () => {
	const { unmount } = render(<ChatWorkspace onAttach={onAttach} />);
	fireEvent.click(screen.getByRole('button', { name: /^Workspace/ }));
	await screen.findByRole('button', { name: 'Attach Projects/notes.md' });
	jest.mocked(window.agent.listWorkspaceFiles).mockResolvedValue([]);
	act(() => onChanged({ type: 'unlink' }));
	expect(await screen.findByText('Workspace is empty.')).toBeInTheDocument();
	unsubscribe.mockClear();
	unmount();
	expect(unsubscribe).toHaveBeenCalledTimes(1);
});

it('shows loading and allows retry after a failed load', async () => {
	jest.mocked(window.agent.listWorkspaceFiles).mockRejectedValueOnce(new Error('Unavailable'));
	render(<ChatWorkspace onAttach={onAttach} />);
	fireEvent.click(screen.getByRole('button', { name: /^Workspace/ }));
	expect(screen.getByText('Loading Workspace…')).toBeInTheDocument();
	expect(await screen.findByRole('alert')).toHaveTextContent('Workspace could not be loaded.');
	fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
	await waitFor(() => expect(screen.getByRole('button', { name: 'Attach Projects/notes.md' })).toBeInTheDocument());
});

it('renders large workspaces in batches and attaches files from later batches', async () => {
	const files = Array.from({ length: 8000 }, (_, index) => ({ type: 'file' as const, name: `file-${index}.md`, path: `Projects/file-${index}.md` }));
	jest.mocked(window.agent.listWorkspaceFiles).mockResolvedValue([{ type: 'directory', name: 'Projects', path: 'Projects', children: files }]);
	render(<ChatWorkspace onAttach={onAttach} />);
	fireEvent.click(screen.getByRole('button', { name: /^Workspace/ }));
	await screen.findByRole('button', { name: 'Attach Projects/file-0.md' });
	expect(screen.getByRole('button', { name: /^Workspace/ })).toHaveTextContent('8000');
	expect(screen.getAllByRole('button', { name: /^Attach / })).toHaveLength(50);
	fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
	expect(screen.getAllByRole('button', { name: /^Attach / })).toHaveLength(100);
	fireEvent.scroll(screen.getByRole('list', { name: 'Workspace files' }), { target: { scrollTop: 3700 } });
	expect(screen.getAllByRole('button', { name: /^Attach / })).toHaveLength(150);
	fireEvent.click(screen.getByRole('button', { name: 'Attach Projects/file-149.md' }));
	await waitFor(() => expect(onAttach).toHaveBeenCalledTimes(1));
	expect(attachmentPath(onAttach.mock.calls[0][0][0])).toBe('/workspace/Projects/file-149.md');
});

it('searches all files by name and folder path, and resets the visible batch', async () => {
	jest.mocked(window.agent.listWorkspaceFiles).mockResolvedValue(Array.from({ length: 8000 }, (_, index) => ({ type: 'file', name: `file-${index}.md`, path: `Projects/file-${index}.md` })));
	render(<ChatWorkspace onAttach={onAttach} />);
	fireEvent.click(screen.getByRole('button', { name: /^Workspace/ }));
	await screen.findByRole('button', { name: 'Show more' });
	fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
	const search = screen.getByRole('textbox', { name: 'Search workspace files' });
	fireEvent.change(search, { target: { value: 'FILE-7999' } });
	expect(screen.getAllByRole('button', { name: /^Attach / })).toHaveLength(1);
	expect(screen.getByRole('button', { name: 'Attach Projects/file-7999.md' })).toBeInTheDocument();
	fireEvent.change(search, { target: { value: 'unmatched' } });
	expect(screen.getByText('No matching files.')).toBeInTheDocument();
	fireEvent.change(search, { target: { value: ' PROJECTS/ ' } });
	expect(screen.getAllByRole('button', { name: /^Attach / })).toHaveLength(50);
	fireEvent.change(search, { target: { value: '' } });
	expect(screen.getAllByRole('button', { name: /^Attach / })).toHaveLength(50);
});

it('keeps failed attachments out of the composer and allows another attempt', async () => {
	jest.mocked(window.agent.readPromptFile).mockRejectedValueOnce(new Error('Unavailable'));
	render(<ChatWorkspace onAttach={onAttach} />);
	fireEvent.click(screen.getByRole('button', { name: /^Workspace/ }));
	const button = await screen.findByRole('button', { name: 'Attach Projects/notes.md' });
	fireEvent.click(button);
	expect(await screen.findByRole('alert')).toHaveTextContent('File could not be attached.');
	expect(onAttach).not.toHaveBeenCalled();
	fireEvent.click(button);
	await waitFor(() => expect(onAttach).toHaveBeenCalledTimes(1));
	expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('resets the batch on collapse so reopening stays bounded', async () => {
	jest.mocked(window.agent.listWorkspaceFiles).mockResolvedValue(Array.from({ length: 120 }, (_, index) => ({ type: 'file', name: `file-${index}.md`, path: `file-${index}.md` })));
	render(<ChatWorkspace onAttach={onAttach} />);
	fireEvent.click(screen.getByRole('button', { name: /^Workspace/ }));
	await screen.findByRole('button', { name: 'Show more' });
	fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
	expect(screen.getAllByRole('button', { name: /^Attach / })).toHaveLength(100);
	fireEvent.click(screen.getByRole('button', { name: /^Workspace/ }));
	fireEvent.click(screen.getByRole('button', { name: /^Workspace/ }));
	expect(screen.getAllByRole('button', { name: /^Attach / })).toHaveLength(50);
	expect(window.agent.listWorkspaceFiles).toHaveBeenCalledTimes(1);
});
