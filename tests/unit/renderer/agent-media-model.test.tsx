import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AgentMediaModelConfiguration } from '../../../src/renderer/src/pages/settings/pages/assistant/media';

const mockCatalog = [
	{
		id: 'gemini-image',
		name: 'Gemini Image',
		type: 'text-to-image',
		provider: { id: 'google', name: 'Google' },
		metadata: {
			documentationUrl: 'https://example.com/google',
			documentationStatus: 'verified',
			inputs: {
				prompt: { type: 'string' },
				aspectRatio: { type: 'string', enum: ['1:1', '16:9'] },
			},
		},
	},
	{
		id: 'grok-image',
		name: 'Grok Image',
		type: 'text-to-image',
		provider: { id: 'xai', name: 'xAI' },
		metadata: {
			documentationUrl: 'https://example.com/xai',
			documentationStatus: 'verified',
			inputs: { resolution: { type: 'string', enum: ['1k', '2k'] } },
		},
	},
	{
		id: 'batch', name: 'Batch', type: 'speech-to-text', apiTypes: ['batch'],
		provider: { id: 'google', name: 'Google' },
	},
	{
		id: 'stream', name: 'Stream', type: 'speech-to-text', apiTypes: ['stream'],
		provider: { id: 'google', name: 'Google' },
	},
];

jest.mock('react-i18next', () => {
	const t = (key: string): string => key;
	return { useTranslation: () => ({ t }) };
});
jest.mock('@/lib/providers', () => ({
	modelsFor: (type: string) => mockCatalog.filter((model) => model.type === type),
	providerIdsFor: () => ['google', 'xai'],
	providerModels: (providerId: string, type: string) =>
		mockCatalog.filter((model) => model.provider.id === providerId && model.type === type),
	providers: () => [
		{ id: 'google', name: 'Google', baseUrl: 'https://google.example' },
		{ id: 'xai', name: 'xAI', baseUrl: 'https://xai.example' },
	],
}));

const api = {
	getProviderId: jest.fn(),
	setProviderId: jest.fn(),
	getModelId: jest.fn(),
	setModelId: jest.fn(),
	getOptions: jest.fn(),
	setOptions: jest.fn(),
};

beforeEach(() => {
	jest.clearAllMocks();
	api.getProviderId.mockResolvedValue('google');
	api.getModelId.mockResolvedValue('gemini-image');
	api.getOptions.mockResolvedValue({ aspectRatio: '16:9' });
	api.setProviderId.mockResolvedValue(undefined);
	api.setModelId.mockResolvedValue(undefined);
	api.setOptions.mockImplementation(async (options) => options);
});

it('does not present an unstored model as selected', async () => {
	api.getProviderId.mockResolvedValue(undefined);
	api.getModelId.mockResolvedValue(undefined);
	render(
		<AgentMediaModelConfiguration api={api} capability="text-to-image" idPrefix="image"
			title="Image" description="Image defaults" showSelectedModel buttonDropdown />
	);
	expect(await screen.findByRole('button', { name: 'Image' })).toHaveTextContent(
		'settings.modelServices.modelPlaceholder'
	);
});

it('offers only batch transcription models and saves through validated selection', async () => {
	const user = userEvent.setup();
	const saveSelection = jest.fn().mockResolvedValue(true);
	api.getProviderId.mockResolvedValue(undefined);
	api.getModelId.mockResolvedValue(undefined);
	render(
		<AgentMediaModelConfiguration api={{ ...api, saveSelection }} capability="speech-to-text"
			idPrefix="transcription" title="Transcription" description="Transcription"
			showSelectedModel buttonDropdown />
	);
	await user.click(await screen.findByRole('button', { name: 'Transcription' }));
	expect(screen.queryByRole('menuitemradio', { name: /Stream/ })).not.toBeInTheDocument();
	await user.click(screen.getByRole('menuitemradio', { name: /Batch/ }));
	await waitFor(() => expect(saveSelection).toHaveBeenCalledWith('google', 'batch'));
	expect(api.setProviderId).not.toHaveBeenCalled();
	expect(api.setModelId).not.toHaveBeenCalled();
});

it('loads media defaults, hides request content, and replaces options when the model changes', async () => {
	const user = userEvent.setup();
	render(
		<AgentMediaModelConfiguration
			api={api}
			capability="text-to-image"
			idPrefix="agent-image"
			title="Image"
			description="Image defaults"
		/>
	);

	await user.click(await screen.findByRole('button', { name: /Image.*Image defaults/ }));
	expect(screen.queryByText('prompt')).not.toBeInTheDocument();
	await user.click(screen.getByRole('button', { name: 'Advanced' }));
	expect(screen.getByText('aspectRatio')).toBeInTheDocument();

	const modelSelect = screen.getAllByRole('combobox')[0];
	await user.click(modelSelect);
	await user.click(await screen.findByRole('option', { name: 'xAI / Grok Image' }));

	await waitFor(() => {
		expect(api.setProviderId).toHaveBeenCalledWith('xai');
		expect(api.setModelId).toHaveBeenCalledWith('grok-image');
		expect(api.setOptions).toHaveBeenCalledWith({});
	});
	expect(screen.queryByText('aspectRatio')).not.toBeInTheDocument();
	await user.click(screen.getByRole('button', { name: 'Advanced' }));
	expect(screen.getByText('resolution')).toBeInTheDocument();
});
