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
];

jest.mock('react-i18next', () => {
	const t = (key: string): string => key;
	return { useTranslation: () => ({ t }) };
});
jest.mock('@/lib/providers', () => ({
	modelsFor: () => mockCatalog,
	providerIdsFor: () => ['google', 'xai'],
	providerModels: (providerId: string) =>
		mockCatalog.filter((model) => model.provider.id === providerId),
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
