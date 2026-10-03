import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NewWorkspace } from '../../../src/renderer/src/pages/code/New';
import type { CoderHarness, CodingSettings } from '../../../src/shared/coding_types';

jest.mock('react-i18next', () => {
	const t = (key: string, fallback?: string): string => fallback ?? key;
	return { useTranslation: () => ({ t }) };
});

const getSettings = jest.fn();
const addProject = jest.fn();
const settings: CodingSettings = { runtime: 'pi', providerId: 'openai', modelId: 'example-model', thinkingLevel: 'medium', toolMode: 'read-only' };
const project = { id: 'new-project', name: 'My workspace', directory: '/managed/new-project', available: true };

beforeEach(() => {
	jest.clearAllMocks();
	getSettings.mockImplementation(async (runtime?: CoderHarness) => ({ ...settings, runtime: runtime ?? 'pi', providerId: runtime === 'codex' ? 'openai-codex' : runtime === 'cline' ? 'cline' : 'openai' }));
	addProject.mockResolvedValue(project);
	Object.defineProperty(window, 'coder', { configurable: true, value: { getSettings, addProject } });
});

it('validates names and creates a workspace that inherits shared settings', async () => {
	const onCreated = jest.fn();
	render(<NewWorkspace onCreated={onCreated} onCancel={jest.fn()} />);
	expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
	fireEvent.change(screen.getByLabelText('Workspace name'), { target: { value: '   ' } });
	fireEvent.click(screen.getByRole('button', { name: 'Create workspace' }));
	expect(await screen.findByRole('alert')).toHaveTextContent('Enter a workspace name');
	expect(addProject).not.toHaveBeenCalled();
	fireEvent.change(screen.getByLabelText('Workspace name'), { target: { value: 'x'.repeat(121) } });
	fireEvent.click(screen.getByRole('button', { name: 'Create workspace' }));
	expect(addProject).not.toHaveBeenCalled();
	fireEvent.change(screen.getByLabelText('Workspace name'), { target: { value: ' My workspace ' } });
	fireEvent.click(screen.getByRole('button', { name: 'Create workspace' }));
	await waitFor(() => expect(onCreated).toHaveBeenCalledWith(project));
	expect(addProject).toHaveBeenCalledWith({ name: 'My workspace' });
});

it('creates a workspace with its edited configuration', async () => {
	const onCreated = jest.fn();
	render(<NewWorkspace onCreated={onCreated} onCancel={jest.fn()} />);
	fireEvent.change(screen.getByLabelText('Workspace name'), { target: { value: 'Configured' } });
	fireEvent.click(screen.getByRole('switch', { name: 'Use shared Coder settings' }));
	fireEvent.change(await screen.findByLabelText('Model'), { target: { value: 'custom-model' } });
	fireEvent.click(screen.getByRole('button', { name: 'Create workspace' }));
	await waitFor(() => expect(onCreated).toHaveBeenCalledWith(project));
	expect(addProject).toHaveBeenCalledWith({ name: 'Configured', settings: { ...settings, modelId: 'custom-model' } });
});

it('retains the name and settings when creation fails and permits retry', async () => {
	addProject.mockRejectedValueOnce(new Error('Write failed'));
	const onCreated = jest.fn();
	render(<NewWorkspace onCreated={onCreated} onCancel={jest.fn()} />);
	fireEvent.change(screen.getByLabelText('Workspace name'), { target: { value: 'Keep me' } });
	fireEvent.click(screen.getByRole('switch', { name: 'Use shared Coder settings' }));
	fireEvent.change(await screen.findByLabelText('Model'), { target: { value: 'keep-model' } });
	fireEvent.click(screen.getByRole('button', { name: 'Create workspace' }));
	expect(await screen.findByRole('alert')).toHaveTextContent('Write failed');
	expect(screen.getByLabelText('Workspace name')).toHaveValue('Keep me');
	expect(screen.getByLabelText('Model')).toHaveValue('keep-model');
	expect(onCreated).not.toHaveBeenCalled();
	fireEvent.click(screen.getByRole('button', { name: 'Create workspace' }));
	await waitFor(() => expect(onCreated).toHaveBeenCalledWith(project));
});

it('reports configuration loading failure with retry and allows cancellation', async () => {
	getSettings.mockRejectedValue(new Error('Settings unavailable'));
	const onCancel = jest.fn();
	render(<NewWorkspace onCreated={jest.fn()} onCancel={onCancel} />);
	fireEvent.click(screen.getByRole('switch', { name: 'Use shared Coder settings' }));
	expect(await screen.findByRole('alert')).toHaveTextContent('Settings unavailable');
	expect(screen.getByRole('button', { name: 'Create workspace' })).toBeDisabled();
	getSettings.mockResolvedValue(settings);
	fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
	expect(await screen.findByLabelText('Model')).toHaveValue('example-model');
	fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
	expect(onCancel).toHaveBeenCalledTimes(1);
	expect(addProject).not.toHaveBeenCalled();
});
