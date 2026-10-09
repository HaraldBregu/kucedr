import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkspaceSelector } from '../../../src/renderer/src/pages/code/Workspace';
import { WorkspaceBreadcrumb } from '../../../src/renderer/src/pages/workspace/Breadcrumb';
import type { CodingProject } from '../../../src/shared/coding_types';
import type { WorkspaceTreeEntry } from '../../../src/shared/agent_types';

jest.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (_key: string, fallback?: string): string => fallback ?? _key }),
}));

const scrollIntoView = jest.fn();

beforeEach(() => {
	Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView });
});

it('reveals and focuses the workspace chosen previously when the picker reopens', async () => {
	const user = userEvent.setup();
	const workspaces: CodingProject[] = ['A', 'B'].map((name) => ({ id: name, name: `Workspace ${name}`, directory: `/${name}`, kind: 'agent-workspace', available: true, createdAt: '', lastOpenedAt: '' }));
	const onSelect = jest.fn();
	const { rerender } = render(<WorkspaceSelector workspace={workspaces[0]} workspaces={workspaces} onSelect={onSelect} />);
	await user.click(screen.getByRole('button', { name: 'Workspaces' }));
	await user.click(screen.getByRole('menuitem', { name: 'Workspace B' }));
	expect(onSelect).toHaveBeenCalledWith('B');
	rerender(<WorkspaceSelector workspace={workspaces[1]} workspaces={workspaces} onSelect={onSelect} />);
	await user.click(screen.getByRole('button', { name: 'Workspaces' }));
	const selected = await screen.findByRole('menuitem', { name: 'Workspace B' });
	await waitFor(() => expect(selected).toHaveFocus());
	expect(selected).toHaveAttribute('aria-current', 'page');
	expect(scrollIntoView.mock.contexts).toContain(selected);
	expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
});

it('opens the selected nested file ancestors and reveals the file each time the breadcrumb picker opens', async () => {
	const user = userEvent.setup();
	const entries: WorkspaceTreeEntry[] = [
		{ name: 'first.ts', path: 'first.ts', type: 'file' },
		{ name: 'folder', path: 'folder', type: 'directory', children: [
			{ name: 'nested', path: 'folder/nested', type: 'directory', children: [
				{ name: 'selected.ts', path: 'folder/nested/selected.ts', type: 'file' },
			] },
		] },
	];
	render(<WorkspaceBreadcrumb entries={entries} path="folder/nested/selected.ts" onFileSelect={jest.fn()} />);
	for (let opening = 0; opening < 2; opening += 1) {
		await user.click(screen.getByRole('button', { name: 'Browse workspace root' }));
		const selected = await screen.findByRole('treeitem', { name: 'selected.ts' });
		await waitFor(() => expect(selected).toHaveFocus());
		expect(selected).toHaveAttribute('aria-selected', 'true');
		expect(screen.getByRole('treeitem', { name: 'folder' })).toHaveAttribute('aria-expanded', 'true');
		expect(screen.getByRole('treeitem', { name: 'nested' })).toHaveAttribute('aria-expanded', 'true');
		expect(scrollIntoView.mock.contexts).toContain(selected);
		await user.keyboard('{Escape}');
	}
});
