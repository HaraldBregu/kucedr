import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ChatWorkspace } from '../../../src/renderer/src/pages/home/Workspace';

const file = { type: 'file', name: 'notes.md', path: 'Projects/notes.md' };
let onChanged: (event: { type: string }) => void;
const unsubscribe = jest.fn();

beforeEach(() => {
	localStorage.clear();
	Object.defineProperty(window, 'agent', { configurable: true, value: {
		listWorkspaceFiles: jest.fn().mockResolvedValue([{ type: 'directory', name: 'Projects', path: 'Projects', children: [file] }]),
		onWorkspaceChanged: jest.fn().mockImplementation((callback) => { onChanged = callback; return unsubscribe; }),
	} });
});

it('opens nested files in Workspace using the persisted selection', async () => {
	render(<MemoryRouter><Routes><Route path="/" element={<ChatWorkspace />} /><Route path="/workspace" element={<p>Workspace page</p>} /></Routes></MemoryRouter>);
	expect(screen.getByRole('button', { name: /^Workspace/ })).toHaveAttribute('aria-expanded', 'false');
	fireEvent.click(screen.getByRole('button', { name: /^Workspace/ }));
	fireEvent.click(await screen.findByRole('button', { name: 'Open Projects/notes.md in Workspace' }));
	expect(await screen.findByText('Workspace page')).toBeInTheDocument();
	expect(localStorage.getItem('workspace-selected-file')).toBe(file.path);
	expect(unsubscribe).toHaveBeenCalled();
});

it('refreshes after workspace changes and cleans up its subscription', async () => {
	const { unmount } = render(<MemoryRouter><ChatWorkspace /></MemoryRouter>);
	fireEvent.click(screen.getByRole('button', { name: /^Workspace/ }));
	await screen.findByRole('button', { name: 'Open Projects/notes.md in Workspace' });
	jest.mocked(window.agent.listWorkspaceFiles).mockResolvedValue([]);
	act(() => onChanged({ type: 'unlink' }));
	expect(await screen.findByText('Workspace is empty.')).toBeInTheDocument();
	unmount();
	expect(unsubscribe).toHaveBeenCalledTimes(1);
});

it('shows loading and allows retry after a failed load', async () => {
	jest.mocked(window.agent.listWorkspaceFiles).mockRejectedValueOnce(new Error('Unavailable'));
	render(<MemoryRouter><ChatWorkspace /></MemoryRouter>);
	fireEvent.click(screen.getByRole('button', { name: /^Workspace/ }));
	expect(screen.getByText('Loading Workspace…')).toBeInTheDocument();
	expect(await screen.findByRole('alert')).toHaveTextContent('Workspace could not be loaded.');
	fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
	await waitFor(() => expect(screen.getByRole('button', { name: 'Open Projects/notes.md in Workspace' })).toBeInTheDocument());
});
