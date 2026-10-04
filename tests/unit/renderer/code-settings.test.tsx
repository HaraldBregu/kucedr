import userEvent from '@testing-library/user-event';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CodeSettings } from '../../../src/renderer/src/pages/code/Settings';
import type { CodingSettings, CoderHarness } from '../../../src/shared/coding_types';

jest.mock('react-i18next', () => {
	const t = (key: string, fallback?: string): string => fallback ?? key;
	return { useTranslation: () => ({ t }) };
});

const getSettings = jest.fn();
const saveSettings = jest.fn();
const settings: CodingSettings = {
	runtime: 'pi', providerId: 'openai', modelId: 'saved-model', thinkingLevel: 'medium', toolMode: 'read-only',
};

beforeEach(() => {
	jest.clearAllMocks();
	getSettings.mockImplementation(async (runtime?: CoderHarness) => ({
		...settings,
		runtime: runtime ?? 'pi',
		providerId: runtime === 'codex' ? 'openai-codex' : runtime === 'cline' ? 'cline' : 'openai',
	}));
	saveSettings.mockResolvedValue(settings);
	Object.defineProperty(window, 'coder', { configurable: true, value: { getSettings, saveSettings } });
});

it('loads shared defaults and saves edited settings only on submit', async () => {
	const onClose = jest.fn();
	render(<CodeSettings onClose={onClose} />);
	const model = await screen.findByLabelText('Model');
	expect(screen.getByRole('heading', { name: 'Coder settings' })).toBeInTheDocument();
	expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
	expect(model).toHaveValue('saved-model');
	fireEvent.change(model, { target: { value: 'updated-model' } });
	expect(saveSettings).not.toHaveBeenCalled();
	fireEvent.click(screen.getByRole('button', { name: 'Save defaults' }));
	await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
	expect(saveSettings).toHaveBeenCalledWith({ ...settings, modelId: 'updated-model' });
});

it('discards unsaved edits when canceled', async () => {
	const onClose = jest.fn();
	render(<CodeSettings onClose={onClose} />);
	fireEvent.change(await screen.findByLabelText('Model'), { target: { value: 'discard-me' } });
	fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
	expect(onClose).toHaveBeenCalledTimes(1);
	expect(saveSettings).not.toHaveBeenCalled();
});

it('keeps edits visible and allows retry when saving fails', async () => {
	saveSettings.mockRejectedValueOnce(new Error('Write failed'));
	const onClose = jest.fn();
	render(<CodeSettings onClose={onClose} />);
	fireEvent.change(await screen.findByLabelText('Model'), { target: { value: 'keep-me' } });
	fireEvent.click(screen.getByRole('button', { name: 'Save defaults' }));
	expect(await screen.findByRole('alert')).toHaveTextContent('Write failed');
	expect(screen.getByLabelText('Model')).toHaveValue('keep-me');
	expect(onClose).not.toHaveBeenCalled();
	await waitFor(() => expect(screen.getByRole('button', { name: 'Save defaults' })).toBeEnabled());
	fireEvent.click(screen.getByRole('button', { name: 'Save defaults' }));
	await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
});

it('reports loading errors and prevents saving unavailable defaults', async () => {
	getSettings.mockRejectedValue(new Error('Unavailable'));
	render(<CodeSettings onClose={jest.fn()} />);
	expect(await screen.findByRole('alert')).toHaveTextContent('Unavailable');
	expect(screen.getByRole('button', { name: 'Save defaults' })).toBeDisabled();
});

it('loads workspace overrides and saves its chosen directory without changing shared defaults', async () => {
	const project = { id: 'workspace-one', name: 'Frontend', directory: '/managed/files', kind: 'agent-workspace' as const, available: true, createdAt: '', lastOpenedAt: '', settings: { ...settings, modelId: 'workspace-model', workingDirectory: '/projects/frontend' } };
	const updateProject = jest.fn().mockResolvedValue(project);
	const pickDirectory = jest.fn().mockResolvedValue('/projects/new-frontend');
	Object.assign(window.coder, { updateProject, pickDirectory });
	const onSaved = jest.fn();
	const onClose = jest.fn();
	render(<CodeSettings project={project} onSaved={onSaved} onClose={onClose} />);
	expect(await screen.findByLabelText('Model')).toHaveValue('workspace-model');
	expect(screen.getByLabelText('Working directory')).toHaveValue('/projects/frontend');
	fireEvent.click(screen.getByRole('button', { name: 'Choose working directory' }));
	await waitFor(() => expect(screen.getByLabelText('Working directory')).toHaveValue('/projects/new-frontend'));
	fireEvent.change(screen.getByLabelText('Workspace name'), { target: { value: 'Frontend app' } });
	fireEvent.click(screen.getByRole('button', { name: 'Save workspace' }));
	await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
	expect(updateProject).toHaveBeenCalledWith('workspace-one', { name: 'Frontend app', settings: { ...project.settings, workingDirectory: '/projects/new-frontend' } });
	expect(saveSettings).not.toHaveBeenCalled();
	expect(onClose).toHaveBeenCalledTimes(1);
});

it('keeps the workspace directory when switching harness and retains edits after an invalid directory save', async () => {
	const project = { id: 'workspace-two', name: 'Backend', directory: '/managed/files', kind: 'agent-workspace' as const, available: true, createdAt: '', lastOpenedAt: '' };
	const updateProject = jest.fn().mockRejectedValue(new Error('Working directory is unavailable.'));
	Object.assign(window.coder, { updateProject });
	render(<CodeSettings project={project} onClose={jest.fn()} />);
	await screen.findByLabelText('Model');
	fireEvent.change(screen.getByLabelText('Working directory'), { target: { value: '/projects/backend' } });
	await userEvent.click(screen.getByLabelText('Harness'));
	await userEvent.click(await screen.findByRole('option', { name: 'Codex', exact: true }));
	expect(screen.getByLabelText('Working directory')).toHaveValue('/projects/backend');
	fireEvent.click(screen.getByRole('button', { name: 'Save workspace' }));
	expect(await screen.findByRole('alert')).toHaveTextContent('Working directory is unavailable.');
	expect(screen.getByLabelText('Working directory')).toHaveValue('/projects/backend');
	expect(updateProject).toHaveBeenCalledWith('workspace-two', expect.objectContaining({ settings: expect.objectContaining({ runtime: 'codex', workingDirectory: '/projects/backend' }) }));
	expect(saveSettings).not.toHaveBeenCalled();
});
