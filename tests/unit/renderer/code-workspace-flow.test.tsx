import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CodePage from '../../../src/renderer/src/pages/code/Page';
import type { CodingProject, CoderHarness } from '../../../src/shared/coding_types';

jest.mock('react-i18next', () => {
	const t = (key: string, fallback?: string): string => fallback ?? key;
	return { useTranslation: () => ({ t }) };
});
jest.mock('../../../src/renderer/src/components/app/base/page', () => ({
	PageContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	Split: ({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) => <div><aside>{sidebar}</aside><main>{children}</main></div>,
}));

const listProjects = jest.fn();
const addProject = jest.fn();
const listMarkdownFiles = jest.fn();
const project: CodingProject = { id: 'new-workspace', name: 'My workspace', directory: '/coder/workspaces/new-workspace/files', kind: 'agent-workspace', available: true, createdAt: '', lastOpenedAt: '' };

beforeEach(() => {
	jest.clearAllMocks();
	localStorage.clear();
	listProjects.mockResolvedValue([]);
	listMarkdownFiles.mockResolvedValue([]);
	addProject.mockImplementation(async () => { listProjects.mockResolvedValue([project]); return project; });
	Object.defineProperty(window, 'coder', { configurable: true, value: {
		listProjects, addProject, listMarkdownFiles,
		getSettings: jest.fn(async (runtime: CoderHarness = 'pi') => ({ runtime, providerId: runtime === 'cline' ? 'cline' : 'openai-codex', modelId: '', thinkingLevel: 'medium', toolMode: 'read-only' })),
	} });
});

it('opens a named workspace configuration page from the empty sidebar and selects the created workspace', async () => {
	render(<MemoryRouter initialEntries={['/code']}><Routes><Route path="/code/*" element={<CodePage />} /></Routes></MemoryRouter>);
	const sidebar = within(screen.getByRole('complementary'));
	expect(await sidebar.findByText('No workspaces yet')).toBeInTheDocument();
	expect(sidebar.getByRole('button', { name: 'New file' })).toBeDisabled();
	fireEvent.click(sidebar.getByRole('button', { name: 'Create workspace' }));
	const page = within(screen.getByRole('main'));
	expect(await page.findByLabelText('Workspace name')).toBeInTheDocument();
	expect(page.getByRole('switch', { name: 'Use shared Coder settings' })).toBeChecked();
	expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
	fireEvent.change(page.getByLabelText('Workspace name'), { target: { value: 'My workspace' } });
	fireEvent.click(page.getByRole('button', { name: 'Create workspace' }));
	await waitFor(() => expect(addProject).toHaveBeenCalledWith({ name: 'My workspace' }));
	expect(await sidebar.findByRole('combobox', { name: 'Workspaces' })).toHaveTextContent('My workspace');
	expect(within(sidebar.getByRole('combobox', { name: 'Workspaces' }).closest('header')!).getByRole('button', { name: 'Coder settings' })).toBeInTheDocument();
	expect(sidebar.queryByText('No workspaces yet')).not.toBeInTheDocument();
	expect(sidebar.getByRole('button', { name: 'New file' })).toBeEnabled();
	expect(await sidebar.findByText('No files yet.')).toBeInTheDocument();
	expect(localStorage.getItem('coder-workspace')).toBe(project.id);
});

it('shows load failures with retry instead of pretending the workspace list is empty', async () => {
	listProjects.mockRejectedValueOnce(new Error('Unable to read workspace storage'));
	render(<MemoryRouter initialEntries={['/code']}><Routes><Route path="/code/*" element={<CodePage />} /></Routes></MemoryRouter>);
	expect(await screen.findByRole('alert')).toHaveTextContent('Unable to read workspace storage');
	const sidebar = within(screen.getByRole('complementary'));
	expect(sidebar.queryByRole('button', { name: 'Create workspace' })).not.toBeInTheDocument();
	fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
	expect(await sidebar.findByRole('button', { name: 'Create workspace' })).toBeInTheDocument();
});

it('offers workspace creation in the empty pane and disables file creation without a workspace', async () => {
	render(<MemoryRouter initialEntries={['/code']}><Routes><Route path="/code/*" element={<CodePage />} /></Routes></MemoryRouter>);
	await screen.findByText('No workspaces yet');
	const page = within(screen.getByRole('main'));
	expect(page.getByRole('button', { name: 'New file' })).toBeDisabled();
	fireEvent.click(page.getByRole('button', { name: 'Create workspace' }));
	expect(await page.findByLabelText('Workspace name')).toBeInTheDocument();
});

it('starts file creation for the selected workspace from the empty pane', async () => {
	listProjects.mockResolvedValue([project]);
	render(<MemoryRouter initialEntries={['/code']}><Routes><Route path="/code/*" element={<CodePage />} /></Routes></MemoryRouter>);
	const action = within(screen.getByRole('main')).getByRole('button', { name: 'New file' });
	await waitFor(() => expect(action).toBeEnabled());
	fireEvent.click(action);
	const sidebar = within(screen.getByRole('complementary'));
	expect(await sidebar.findByLabelText('File name')).toHaveFocus();
	expect(sidebar.getByRole('button', { name: 'Create' })).toBeInTheDocument();
});

it('opens Coder settings from the sidebar footer and marks it selected', async () => {
	render(<MemoryRouter initialEntries={['/code']}><Routes><Route path="/code/*" element={<CodePage />} /></Routes></MemoryRouter>);
	await screen.findByText('No workspaces yet');
	const button = within(screen.getByRole('complementary')).getAllByRole('button', { name: 'Coder settings' }).find((item) => item.closest('footer'))!;
	fireEvent.click(button);
	expect(await within(screen.getByRole('main')).findByRole('heading', { name: 'Coder settings' })).toBeInTheDocument();
	expect(button).toHaveAttribute('aria-current', 'page');
});
