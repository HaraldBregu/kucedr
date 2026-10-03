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
