import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AssistantPage from '../../../src/renderer/src/pages/settings/pages/assistant/Page';
import RealtimeConversationConfiguration from '../../../src/renderer/src/pages/settings/pages/assistant/conversation';
import TasksPage from '../../../src/renderer/src/pages/settings/pages/tasks/Page';

const mockProviders = [
	{ id: 'openai', name: 'OpenAI', baseUrl: 'https://openai.example' },
	{ id: 'google', name: 'Google', baseUrl: 'https://google.example' },
	{ id: 'elevenlabs', name: 'ElevenLabs', baseUrl: 'https://elevenlabs.example' },
	{ id: 'xai', name: 'xAI', baseUrl: 'https://xai.example' },
];
const mockCatalog = [
	{
		id: 'gpt',
		name: 'GPT',
		type: 'llm',
		provider: mockProviders[0],
		metadata: {
			documentationStatus: 'verified',
			documentationUrl: '',
			inputs: {
				reasoning: { type: 'string', title: 'Reasoning', enum: ['low', 'medium'] },
			},
		},
	},
	{
		id: 'gemini-image',
		name: 'Gemini Image',
		type: 'text-to-image',
		provider: mockProviders[1],
		metadata: { documentationStatus: 'verified', documentationUrl: '', inputs: {} },
	},
	{
		id: 'gpt-realtime',
		name: 'GPT Realtime',
		type: 'realtime-voice',
		default: true,
		provider: mockProviders[0],
		metadata: {
			documentationStatus: 'verified',
			documentationUrl: '',
			inputs: {
				voice: { type: 'string', title: 'Voice', enum: ['marin', 'cedar'], default: 'marin' },
			},
		},
	},
	{
		id: 'grok-voice',
		name: 'Grok Voice',
		type: 'realtime-voice',
		provider: mockProviders[3],
		metadata: {
			documentationStatus: 'verified',
			documentationUrl: '',
			inputs: { voice: { type: 'string', title: 'Voice', enum: ['Ara', 'Eve'], default: 'Ara' } },
		},
	},
	{
		id: 'custom-realtime',
		name: 'Custom Realtime',
		type: 'realtime-voice',
		provider: mockProviders[0],
		metadata: { documentationStatus: 'verified', documentationUrl: '', inputs: {} },
	},
	{
		id: 'eleven_v3',
		name: 'Eleven v3',
		type: 'text-to-speech',
		provider: mockProviders[2],
		metadata: {
			documentationStatus: 'verified',
			documentationUrl: '',
			inputs: { voice_id: { type: 'string', title: 'Voice ID' } },
		},
	},
	{
		id: 'eleven-music',
		name: 'Eleven Music',
		type: 'text-to-audio',
		provider: mockProviders[2],
		metadata: { documentationStatus: 'verified', documentationUrl: '', inputs: {} },
	},
	{
		id: 'veo',
		name: 'Veo',
		type: 'text-to-video',
		provider: mockProviders[1],
		metadata: { documentationStatus: 'verified', documentationUrl: '', inputs: {} },
	},
];

jest.mock('react-i18next', () => {
	const translations: Record<string, string> = {
		'settings.modelServices.assistantName': 'Agent',
		'settings.modelServices.kucedrDescription': 'Chat, tools, and planning',
		'settings.modelServices.configuration': 'Configuration',
		'settings.modelServices.toolModels': 'Tool models',
		'settings.modelServices.subtitle': 'Configure model assignments',
		'settings.modelServices.imageAssistantName': 'Image',
		'settings.modelServices.voiceName': 'Voice',
		'settings.modelServices.textToSpeechModelDescription': 'Text to speech model',
		'settings.modelServices.transcriptionName': 'Transcription',
		'settings.modelServices.transcriptionDescription': 'Speech-to-text transcription',
		'settings.modelServices.musicCreatorName': 'Audio',
		'settings.modelServices.videoCreatorName': 'Video',
		'settings.modelServices.imageModelDescription': 'Image defaults',
		'settings.modelServices.musicModelDescription': 'Audio defaults',
		'settings.modelServices.videoModelDescription': 'Video defaults',
		'settings.modelServices.model': 'Model',
		'settings.modelServices.llmModel': 'LLM Model',
		'settings.modelServices.modelDescription': 'Choose provider and model',
		'settings.modelServices.modelPlaceholder': 'Select model',
		'settings.cron.actions.enable': 'Enable',
		'settings.cron.actions.disable': 'Disable',
		'settings.cron.schedule.everyMinutes': 'Every {{count}} minutes',
		'settings.modelServices.realtimeConversationConfiguration': 'Realtime conversation',
		'settings.modelServices.realtimeConversationDescription': 'Live model and voice',
		'settings.modelServices.loadError': 'Unable to load models',
		'settings.modelServices.saveError': 'Unable to save model',
		'settings.modelServices.history': 'History',
		'settings.tabs.searchEngine': 'Search Engine',
		'settings.tabs.permissions': 'Permissions',
		'settings.overview.descriptions.permissions': 'Manage permissions',
		'settings.dataControls.title': 'Data management',
		'settings.dataControls.description': 'Export or purge assistant data',
		'settings.rag.title': 'RAG',
		'settings.overview.descriptions.rag': 'Document search and index',
		'settings.wiki.title': 'LLM Wiki',
		'settings.wiki.description': 'Build a persistent Markdown wiki',
	};
	const t = (key: string, options?: Record<string, unknown>): string => {
		const value = translations[key] ?? key;
		return Object.entries(options ?? {}).reduce(
			(result, [name, replacement]) => result.replaceAll(`{{${name}}}`, String(replacement)),
			value
		);
	};
	return { useTranslation: () => ({ t }) };
});
jest.mock('@/lib/providers', () => ({
	modelsFor: (capability: string) => mockCatalog.filter((model) => model.type === capability),
	providerIdsFor: (capability: string) => [
		...new Set(
			mockCatalog.filter((model) => model.type === capability).map((model) => model.provider.id)
		),
	],
	providerModels: (providerId: string, capability: string) =>
		mockCatalog.filter((model) => model.provider.id === providerId && model.type === capability),
	providers: () => mockProviders,
}));

const mediaApi = (providerId: string, modelId: string) => ({
	getProviderId: jest.fn().mockResolvedValue(providerId),
	setProviderId: jest.fn().mockResolvedValue(undefined),
	getModelId: jest.fn().mockResolvedValue(modelId),
	setModelId: jest.fn().mockResolvedValue(undefined),
	getOptions: jest.fn().mockResolvedValue({}),
	setOptions: jest.fn().mockImplementation(async (options) => options),
});

const realtimeSetSetup = jest.fn();

beforeEach(() => {
	if (!window.PointerEvent) {
		Object.defineProperty(window, 'PointerEvent', {
			configurable: true,
			value: MouseEvent,
		});
	}
	Object.defineProperty(window, 'agent', {
		configurable: true,
		value: {
			getProvider: jest.fn().mockResolvedValue(mockProviders[0]),
			setProvider: jest.fn().mockResolvedValue(true),
			getModelId: jest.fn().mockResolvedValue('gpt'),
			setModelId: jest.fn().mockResolvedValue(true),
			getModelOptions: jest.fn().mockResolvedValue({}),
			setModelOptions: jest.fn().mockResolvedValue({}),
			ragGetConfiguration: jest.fn().mockResolvedValue({ indexName: 'knowledge-base' }),
			listSessions: jest.fn().mockResolvedValue([
				{
					id: '11111111-1111-4111-8111-111111111111',
					title: 'Session',
					createdAtMs: 1,
				},
			]),
		},
	});
	Object.defineProperty(window, 'models', {
		configurable: true,
		value: {
			realtimeVoice: {
				getSetup: jest.fn().mockResolvedValue({
					providerId: 'openai',
					modelId: 'gpt-realtime',
					options: { voice: 'marin' },
					supportedModels: [
						{ providerId: 'openai', modelId: 'gpt-realtime' },
						{ providerId: 'xai', modelId: 'grok-voice' },
					],
				}),
				setSetup: realtimeSetSetup.mockImplementation(async (request) => ({
					...request,
					supportedModels: [
						{ providerId: 'openai', modelId: 'gpt-realtime' },
						{ providerId: 'xai', modelId: 'grok-voice' },
					],
				})),
			},
			voice: mediaApi('elevenlabs', 'eleven_v3'),
			transcribe: mediaApi('openai', 'gpt-transcribe'),
			image: mediaApi('google', 'gemini-image'),
			sound: mediaApi('elevenlabs', 'eleven-music'),
			video: mediaApi('google', 'veo'),
		},
	});
	Object.defineProperty(window, 'search', {
		configurable: true,
		value: {
			getSettings: jest.fn().mockResolvedValue({
				engineId: 'brave',
				configured: { brave: true, tavily: false },
			}),
			selectEngine: jest.fn().mockImplementation(async (engineId: string) => ({
				engineId,
				configured: { brave: true, tavily: false },
			})),
		},
	});
	Object.defineProperty(window, 'wiki', {
		configurable: true,
		value: { getSettings: jest.fn().mockResolvedValue({ targetPath: '/wiki' }) },
	});
	Object.defineProperty(window, 'tasks', {
		configurable: true,
		value: {
			list: jest.fn().mockResolvedValue([]),
			getRuntime: jest.fn().mockResolvedValue({ providerId: 'openai', modelId: 'gpt' }),
			setRuntime: jest.fn().mockResolvedValue({ providerId: 'openai', modelId: 'gpt' }),
			setEnabled: jest.fn(),
		},
	});
	jest.clearAllMocks();
});

it('groups independently collapsible provider settings in one card', async () => {
	const user = userEvent.setup();
	render(
		<MemoryRouter>
			<AssistantPage />
		</MemoryRouter>
	);

	expect(screen.queryByRole('heading', { name: 'Configuration' })).not.toBeInTheDocument();
	expect(screen.queryByRole('heading', { name: 'History' })).not.toBeInTheDocument();
	const cards: Array<Element | null> = [];
	for (const name of [
		/Model/,
		/Realtime conversation/,
		/Voice/,
		/Image/,
		/Audio/,
		/Video/,
		/Search Engine/,
	]) {
		const trigger = (await screen.findAllByRole('button', { name })).find(
			(element) => element.getAttribute('data-slot') === 'collapsible-trigger'
		);
		expect(trigger).toBeDefined();
		if (!trigger) continue;
		expect(trigger).toHaveAttribute('aria-expanded', 'false');
		await user.click(trigger);
		expect(trigger).toHaveAttribute('aria-expanded', 'true');
		cards.push(trigger.closest('[data-slot="card"]'));
	}
	const model = (await screen.findAllByRole('button', { name: 'LLM Model' })).find(
		(element) => element.getAttribute('aria-haspopup') === 'dialog'
	);
	expect(model).toBeDefined();
	if (!model) return;
	const voiceTrigger = (await screen.findAllByRole('button', { name: /Voice/ })).find(
		(element) => element.getAttribute('data-slot') === 'collapsible-trigger'
	);
	expect(voiceTrigger).toBeDefined();
	if (!voiceTrigger) return;
	expect(voiceTrigger).toHaveTextContent('Text to speech model');
	expect(voiceTrigger.nextElementSibling).not.toHaveClass('border-t');
	expect(screen.getAllByText('Text to speech model')).toHaveLength(1);
	const voice = (await screen.findAllByRole('button', { name: 'Voice' })).find(
		(entry) => entry.getAttribute('aria-haspopup') === 'dialog'
	);
	const realtimeConversation = (
		await screen.findAllByRole('button', { name: 'Realtime conversation' })
	).find((entry) => entry.getAttribute('aria-haspopup') === 'dialog');
	const image = (await screen.findAllByRole('button', { name: 'Image' })).find(
		(entry) => entry.getAttribute('aria-haspopup') === 'dialog'
	);
	const audio = (await screen.findAllByRole('button', { name: 'Audio' })).find(
		(entry) => entry.getAttribute('aria-haspopup') === 'dialog'
	);
	const video = (await screen.findAllByRole('button', { name: 'Video' })).find(
		(entry) => entry.getAttribute('aria-haspopup') === 'dialog'
	);
	expect(voice).toBeDefined();
	expect(realtimeConversation).toBeDefined();
	expect(image).toBeDefined();
	expect(audio).toBeDefined();
	expect(video).toBeDefined();
	if (!voice || !realtimeConversation || !image || !audio || !video) return;
	const search = await screen.findByRole('combobox', { name: 'Search Engine' });
	expect(voice).toHaveTextContent('Eleven v3');
	expect(model).toHaveTextContent('GPT');
	expect(realtimeConversation).toHaveTextContent('GPT Realtime');
	expect(voice).toHaveTextContent('Eleven v3');
	expect(image).toHaveTextContent('Gemini Image');
	expect(audio).toHaveTextContent('Eleven Music');
	expect(video).toHaveTextContent('Veo');
	expect(search).toHaveTextContent('Brave');

	expect(cards.every(Boolean)).toBe(true);
	expect(new Set(cards.slice(0, 3)).size).toBe(1);
	expect(new Set(cards.slice(3)).size).toBe(1);
	expect(cards[3]).not.toBe(cards[0]);

	const wiki = screen.getByRole('button', { name: /LLM Wiki/ });
	const rag = screen.getByRole('button', { name: /RAG/ });
	const permissions = screen.getByRole('button', { name: /Permissions/ });
	const dataManagement = screen.getByRole('button', { name: /Data management/ });
	expect(
		wiki.compareDocumentPosition(dataManagement) & Node.DOCUMENT_POSITION_FOLLOWING
	).toBeTruthy();
	expect(rag.closest('[data-slot="card"]')).toBe(wiki.closest('[data-slot="card"]'));
	expect(permissions.closest('[data-slot="card"]')).not.toBe(rag.closest('[data-slot="card"]'));
	expect(dataManagement.closest('[data-slot="card"]')).not.toBe(wiki.closest('[data-slot="card"]'));
});

it('shows only runtime-supported realtime models and saves model and voice together', async () => {
	const user = userEvent.setup();
	render(
		<MemoryRouter>
			<AssistantPage />
		</MemoryRouter>
	);

	const trigger = (await screen.findAllByRole('button', { name: /Realtime conversation/ })).find(
		(element) => element.getAttribute('data-slot') === 'collapsible-trigger'
	);
	expect(trigger).toBeDefined();
	if (!trigger) return;
	await user.click(trigger);
	const selector = (await screen.findAllByRole('button', { name: 'Realtime conversation' })).find(
		(element) => element.getAttribute('aria-haspopup') === 'dialog'
	);
	expect(selector).toBeDefined();
	if (!selector) return;
	await user.click(selector);
	expect(screen.queryByRole('menuitemradio', { name: /Custom Realtime/ })).not.toBeInTheDocument();
	await user.click(await screen.findByRole('menuitemradio', { name: /Grok Voice/ }));

	await waitFor(() => {
		expect(realtimeSetSetup).toHaveBeenCalledWith({
			providerId: 'xai',
			modelId: 'grok-voice',
			options: { voice: 'Ara' },
		});
	});
});

it('leaves realtime conversation unselected when catalog defaults are disabled', async () => {
	const user = userEvent.setup();
	(window.models.realtimeVoice.getSetup as jest.Mock).mockResolvedValueOnce({
		providerId: '',
		modelId: '',
		options: {},
		supportedModels: [{ providerId: 'openai', modelId: 'gpt-realtime' }],
	});
	render(<RealtimeConversationConfiguration selectDefaultModel={false} />);

	const trigger = await screen.findByRole('button', { name: /Realtime conversation/ });
	expect(trigger).toHaveTextContent('Select model');
	await user.click(trigger);
	const selector = await screen.findByRole('combobox', { name: 'Realtime conversation' });
	expect(selector).not.toHaveTextContent('GPT Realtime');
	expect(realtimeSetSetup).not.toHaveBeenCalled();
});

it('uses the Agent model picker UI and task switches', async () => {
	const user = userEvent.setup();
	const task = {
		id: 'task-1',
		name: 'Demo task',
		description: 'Task description',
		cronExpression: '*/12 * * * *',
		enabled: true,
		action: { type: 'agent' as const, prompt: 'Do the work', effort: 'medium' as const },
		sessionIds: [],
		createdAt: '2026-09-10T00:00:00.000Z',
		updatedAt: '2026-09-10T00:00:00.000Z',
	};
	(window.tasks.list as jest.Mock).mockResolvedValue([task]);
	(window.tasks.setEnabled as jest.Mock).mockResolvedValueOnce({ ...task, enabled: false });

	render(
		<MemoryRouter>
			<TasksPage />
		</MemoryRouter>
	);
	const modelTrigger = (await screen.findAllByRole('button', { name: /LLM Model/ })).find(
		(element) => element.getAttribute('data-slot') === 'collapsible-trigger'
	);
	expect(modelTrigger).toBeDefined();
	if (!modelTrigger) return;
	expect(modelTrigger).toHaveTextContent('Choose provider and model');
	expect(
		modelTrigger.parentElement?.querySelector('button[aria-haspopup="dialog"]')
	).toBeInTheDocument();
	await user.click(modelTrigger);
	expect(await screen.findByRole('combobox', { name: 'Reasoning' })).toBeInTheDocument();
	expect(screen.getByText('Task description')).toBeInTheDocument();
	expect(screen.getByText('Every 12 minutes')).toBeInTheDocument();
	const taskSwitch = await screen.findByRole('switch', { name: 'Disable Demo task' });
	expect(taskSwitch).toBeChecked();
	await user.click(taskSwitch);
	await waitFor(() => {
		expect(window.tasks.setEnabled).toHaveBeenCalledWith('task-1', false);
		expect(taskSwitch).not.toBeChecked();
	});
});

it('announces a realtime conversation setup save error', async () => {
	const user = userEvent.setup();
	realtimeSetSetup.mockRejectedValueOnce(new Error('Realtime setup could not be saved.'));
	render(
		<MemoryRouter>
			<AssistantPage />
		</MemoryRouter>
	);

	const trigger = (await screen.findAllByRole('button', { name: /Realtime conversation/ })).find(
		(element) => element.getAttribute('data-slot') === 'collapsible-trigger'
	);
	expect(trigger).toBeDefined();
	if (!trigger) return;
	await user.click(trigger);
	const selector = (await screen.findAllByRole('button', { name: 'Realtime conversation' })).find(
		(element) => element.getAttribute('aria-haspopup') === 'dialog'
	);
	expect(selector).toBeDefined();
	if (!selector) return;
	await user.click(selector);
	await user.click(await screen.findByRole('menuitemradio', { name: /Grok Voice/ }));

	expect(await screen.findByRole('alert')).toHaveTextContent('Realtime setup could not be saved.');
});

it.each([
	['settings.tabs.skills', '/settings/agent/skills', 'link'],
	['settings.tabs.taskScheduler', '/settings/agent/tasks', 'link'],
	['settings.tabs.mcp', '/settings/agent/mcp', 'link'],
	['Data management', '/settings/agent/data', 'button'],
	['RAG', '/settings/agent/rag', 'button'],
	['LLM Wiki', '/settings/agent/llm-wiki', 'button'],
])('opens %s from the Agent settings page', async (label, path, role) => {
	const user = userEvent.setup();
	render(
		<MemoryRouter initialEntries={['/settings/agent']}>
			<Routes>
				<Route path="/settings/agent" element={<AssistantPage />} />
				<Route path={path} element={<p>{label} page</p>} />
			</Routes>
		</MemoryRouter>
	);

	await user.click(screen.getByRole(role, { name: new RegExp(label) }));
	expect(await screen.findByText(`${label} page`)).toBeInTheDocument();
});
