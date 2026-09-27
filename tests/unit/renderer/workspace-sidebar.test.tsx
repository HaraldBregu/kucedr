import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { WorkspaceSidebar } from '../../../src/renderer/src/pages/workspace/Sidebar';

jest.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, fallback?: string | { name?: string }): string => {
			if (typeof fallback === 'string') return fallback;
			return fallback?.name ? `${key} ${fallback.name}` : key;
		},
	}),
}));

jest.mock('../../../src/renderer/src/components/app/SidebarFooter', () => ({
	AppSidebarFooter: () => <div data-slot="sidebar-footer" />,
}));

const listWorkspaceFiles = jest.fn();
const createWorkspaceFile = jest.fn();
const createWorkspaceDirectory = jest.fn();
const renameWorkspaceEntry = jest.fn();
const revealWorkspaceEntry = jest.fn();
const deleteWorkspaceFile = jest.fn();
const deleteWorkspaceDirectory = jest.fn();
const showContextMenu = jest.fn();

beforeEach(() => {
	jest.clearAllMocks();
	Object.defineProperty(window, 'agent', {
		configurable: true,
		value: {
			listWorkspaceFiles,
			createWorkspaceFile,
			createWorkspaceDirectory,
			renameWorkspaceEntry,
			revealWorkspaceEntry,
			deleteWorkspaceFile,
			deleteWorkspaceDirectory,
			onWorkspaceChanged: () => () => undefined,
		},
	});
	Object.defineProperty(window, 'win', {
		configurable: true,
		value: { showContextMenu },
	});
});

it('creates, renames, and deletes a file through the right click menu', async () => {
	const user = userEvent.setup();
	const onFileSelect = jest.fn();
	const onEntryRenamed = jest.fn();
	const onEntryDeleted = jest.fn();
	listWorkspaceFiles
		.mockResolvedValueOnce([])
		.mockResolvedValueOnce([{ type: 'file', name: 'draft.md', path: 'draft.md' }])
		.mockResolvedValueOnce([{ type: 'file', name: 'final.md', path: 'final.md' }])
		.mockResolvedValueOnce([]);
	createWorkspaceFile.mockResolvedValue('draft.md');
	renameWorkspaceEntry.mockResolvedValue('final.md');
	deleteWorkspaceFile.mockResolvedValue(undefined);
	showContextMenu
		.mockResolvedValueOnce('create-file')
		.mockResolvedValueOnce('rename')
		.mockResolvedValueOnce('delete');

	render(
		<MemoryRouter>
			<WorkspaceSidebar
				onFileSelect={onFileSelect}
				onEntryRenamed={onEntryRenamed}
				onEntryDeleted={onEntryDeleted}
				selectedPath={null}
			/>
		</MemoryRouter>
	);
	const tree = screen.getByRole('navigation', { name: 'Workspace files' });
	await screen.findByText('Workspace is empty.');
	fireEvent.contextMenu(tree);
	await user.type(await screen.findByRole('textbox', { name: 'Name' }), 'draft.md');
	await user.click(screen.getByRole('button', { name: 'Create' }));
	await waitFor(() => expect(createWorkspaceFile).toHaveBeenCalledWith('', 'draft.md'));
	expect(onFileSelect).toHaveBeenCalledWith({ type: 'file', name: 'draft.md', path: 'draft.md' });

	fireEvent.contextMenu(await screen.findByRole('button', { name: 'draft.md' }));
	const name = await screen.findByRole('textbox', { name: 'Name' });
	expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
	await user.clear(name);
	await user.type(name, 'final.md');
	await user.keyboard('{Enter}');
	await waitFor(() => expect(renameWorkspaceEntry).toHaveBeenCalledWith('draft.md', 'final.md'));
	expect(onEntryRenamed).toHaveBeenCalledWith('draft.md', 'final.md');

	fireEvent.contextMenu(await screen.findByRole('button', { name: 'final.md' }));
	await user.click(await screen.findByRole('button', { name: 'Delete' }));
	await waitFor(() => expect(deleteWorkspaceFile).toHaveBeenCalledWith('final.md'));
	expect(onEntryDeleted).toHaveBeenCalledWith('final.md');
	await screen.findByText('Workspace is empty.');
});

it('cancels an inline folder rename with Escape', async () => {
	const user = userEvent.setup();
	listWorkspaceFiles.mockResolvedValue([{ type: 'directory', name: 'Notes', path: 'Notes', children: [] }]);
	showContextMenu.mockResolvedValue('rename');
	render(<MemoryRouter><WorkspaceSidebar onFileSelect={jest.fn()} onEntryRenamed={jest.fn()} onEntryDeleted={jest.fn()} selectedPath={null} /></MemoryRouter>);
	const folder = await screen.findByText('Notes');
	fireEvent.contextMenu(folder.closest('summary') as HTMLElement);
	const name = await screen.findByRole('textbox', { name: 'Name' });
	await user.clear(name);
	await user.type(name, 'Journal');
	await user.keyboard('{Escape}');
	expect(screen.queryByRole('textbox', { name: 'Name' })).not.toBeInTheDocument();
	expect(screen.getByText('Notes')).toBeInTheDocument();
	expect(renameWorkspaceEntry).not.toHaveBeenCalled();
});

it('creates inside and deletes a folder from its right click menu', async () => {
	const user = userEvent.setup();
	listWorkspaceFiles.mockResolvedValue([
		{ type: 'directory', name: 'Notes', path: 'Notes', children: [] },
	]);
	createWorkspaceDirectory.mockResolvedValue('Notes/New');
	deleteWorkspaceDirectory.mockResolvedValue(undefined);
	showContextMenu.mockResolvedValueOnce('create-folder').mockResolvedValueOnce('delete');
	render(
		<MemoryRouter>
			<WorkspaceSidebar
				onFileSelect={jest.fn()}
				onEntryRenamed={jest.fn()}
				onEntryDeleted={jest.fn()}
				selectedPath={null}
			/>
		</MemoryRouter>
	);
	const folder = await screen.findByText('Notes');
	fireEvent.contextMenu(folder.closest('summary') as HTMLElement);
	await user.type(await screen.findByRole('textbox', { name: 'Name' }), 'New');
	await user.click(screen.getByRole('button', { name: 'Create' }));
	await waitFor(() => expect(createWorkspaceDirectory).toHaveBeenCalledWith('Notes', 'New'));
	fireEvent.contextMenu(folder.closest('summary') as HTMLElement);
	await user.click(await screen.findByRole('button', { name: 'Delete' }));
	await waitFor(() => expect(deleteWorkspaceDirectory).toHaveBeenCalledWith('Notes'));
});

it('reveals the right-clicked file or folder', async () => {
	listWorkspaceFiles.mockResolvedValue([
		{ type: 'directory', name: 'Notes', path: 'Notes', children: [
			{ type: 'file', name: 'plan.md', path: 'Notes/plan.md' },
		] },
	]);
	revealWorkspaceEntry.mockResolvedValue(undefined);
	showContextMenu.mockResolvedValue('reveal');
	render(<MemoryRouter><WorkspaceSidebar onFileSelect={jest.fn()} onEntryRenamed={jest.fn()} onEntryDeleted={jest.fn()} selectedPath={null} /></MemoryRouter>);
	const folder = await screen.findByText('Notes');
	fireEvent.contextMenu(folder.closest('summary') as HTMLElement);
	await waitFor(() => expect(revealWorkspaceEntry).toHaveBeenCalledWith('Notes'));
	await userEvent.setup().click(folder);
	fireEvent.contextMenu(await screen.findByRole('button', { name: 'plan.md' }));
	await waitFor(() => expect(revealWorkspaceEntry).toHaveBeenCalledWith('Notes/plan.md'));
	expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
