import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ChatWorkspace } from '../../../src/renderer/src/pages/home/Workspace';

const file = { type: 'file', name: 'notes.md', path: 'Projects/notes.md' };
let onChanged: (event: { type: string }) => void;
const unsubscribe = jest.fn();
const onAttach = jest.fn();

beforeEach(() => {
	localStorage.clear();
	Object.defineProperty(window, 'agent', { configurable: true, value: {
		getWorkspaceLocation: jest.fn().mockResolvedValue('/workspace/'),
		listWorkspaceFiles: jest.fn().mockResolvedValue([{ type: 'directory', name: 'Projects', path: 'Projects', children: [file] }]),
		onWorkspaceChanged: jest.fn().mockImplementation((callback) => { onChanged = callback; return unsubscribe; }),
	} });
});

it('selects nested workspace files as chat attachments without navigating', async () => {
	render(<ChatWorkspace onAttach={onAttach} />);
	expect(screen.getByRole('button', { name: /^Workspace/ })).toHaveAttribute('aria-expanded', 'false');
	fireEvent.click(screen.getByRole('button', { name: /^Workspace/ }));
	fireEvent.click(await screen.findByRole('button', { name: 'Attach Projects/notes.md' }));
	expect(onAttach).toHaveBeenCalledWith([{ name: 'notes.md', path: '/workspace/Projects/notes.md' }]);
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
	expect(onAttach).toHaveBeenCalledWith([{ name: 'file-149.md', path: '/workspace/Projects/file-149.md' }]);
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
