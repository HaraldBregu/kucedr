import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ModelsPage from '../../../src/renderer/src/pages/settings/pages/models/Page';

jest.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

it('groups plugin models by type, omits empty types, and refreshes when plugins change', async () => {
	let changed = (): void => undefined;
	const provider = { id: 'provider', name: 'Provider', plugin: { id: 'plugin', name: 'Plugin' } };
	const models = jest.fn().mockResolvedValue([
		{ id: 'image', name: 'Image model', type: 'text-to-image', provider },
		{ id: 'chat', name: 'Chat model', type: 'llm', provider },
		{ id: 'other', name: 'Other model', type: 'text-to-speech', provider: { id: 'other' } },
	]);
	Object.assign(window, {
		app: {
			models,
			onModelsChanged: (callback: () => void) => {
				changed = callback;
				return jest.fn();
			},
		},
		provider: { getModelProviders: jest.fn().mockResolvedValue([]) },
	});
	render(<ModelsPage />);
	expect(await screen.findByText('Image model')).toBeInTheDocument();
	expect(screen.getByText('Chat model')).toBeInTheDocument();
	expect(screen.getByText('Image model').closest('[data-slot="card"]')).not.toBe(
		screen.getByText('Chat model').closest('[data-slot="card"]')
	);
	expect(
		screen.getByRole('heading', { name: 'settings.models.types.text-to-image' })
	).toBeInTheDocument();
	expect(
		screen.queryByRole('heading', { name: 'settings.models.types.text-to-speech' })
	).not.toBeInTheDocument();
	expect(screen.queryByText('Other model')).not.toBeInTheDocument();
	fireEvent.change(screen.getByRole('searchbox', { name: 'settings.modelServices.searchModels' }), {
		target: { value: 'image' },
	});
	expect(screen.getByText('Image model')).toBeInTheDocument();
	expect(screen.queryByText('Chat model')).not.toBeInTheDocument();
	expect(
		screen.queryByRole('heading', { name: 'settings.models.types.llm' })
	).not.toBeInTheDocument();
	fireEvent.change(screen.getByRole('searchbox', { name: 'settings.modelServices.searchModels' }), {
		target: { value: 'missing' },
	});
	expect(screen.getByText('settings.modelServices.noMatchingModels')).toBeInTheDocument();
	models.mockResolvedValue([]);
	act(() => changed());
	await waitFor(() => expect(screen.getByText('settings.models.empty')).toBeInTheDocument());
	expect(screen.queryByText('Image model')).not.toBeInTheDocument();
});
