import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AssistantPage from '../../../src/renderer/src/pages/settings/pages/assistant/Page';
import RealtimeConversationConfiguration from '../../../src/renderer/src/pages/settings/pages/assistant/conversation';
import VoicePage from '../../../src/renderer/src/pages/settings/pages/voice/Page';
import ToolsPage from '../../../src/renderer/src/pages/settings/pages/assistant/tools/Page';
import McpToolsPage from '../../../src/renderer/src/pages/settings/pages/assistant/mcptools/Page';
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
		id: 'gpt-transcribe',
		name: 'GPT Transcribe',
		type: 'speech-to-text',
		provider: mockProviders[0],
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
		'settings.modelServices.chatName': 'Chat',
		'settings.modelServices.kucedrDescription': 'Chat, tools, and planning',
		'settings.modelServices.configuration': 'Configuration',
		'settings.modelServices.tools': 'Tools',
		'settings.modelServices.agentTools.mcp.title': 'MCP Tools',
		'settings.modelServices.agentTools.mcp.description': 'Configure MCP tools for chat.',
		'settings.modelServices.toolModels': 'Tool models',
		'settings.modelServices.subtitle': 'Configure model assignments',
		'settings.modelServices.imageAssistantName': 'Text to image',
		'settings.modelServices.voiceName': 'Speech synthesis',
		'settings.modelServices.voiceDescription': 'Realtime conversations and spoken output',
		'settings.tabs.voice': 'Voice',
		'settings.sidebar.voiceConversation': 'Voice conversation',
		'settings.modelServices.textToSpeechModelDescription': 'Text to speech model',
		'settings.modelServices.transcriptionName': 'Transcription',
		'settings.modelServices.transcriptionDescription': 'Speech-to-text transcription',
		'settings.modelServices.musicCreatorName': 'Text to audio',
		'settings.modelServices.videoCreatorName': 'Text to video',
		'settings.modelServices.agentTools.filePermissionLabel': 'File Tools Permission',
		'settings.modelServices.agentTools.permissions.ask': 'Ask',
		'settings.modelServices.agentTools.permissions.allow': 'Always Allow',
		'settings.modelServices.agentTools.permissions.deny': 'Deny',
		'settings.modelServices.agentTools.discovery.name': 'Discover tools',
		'settings.modelServices.agentTools.discovery.description': 'Find and load tools when needed.',
		'settings.modelServices.agentTools.groups.core': 'Core',
		'settings.modelServices.agentTools.groups.system': 'System',
		'settings.modelServices.agentTools.discovery.required': 'Required',
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
		'settings.rag.title': 'Knowledge Base',
		'settings.overview.descriptions.rag': 'Document search and index',
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
	const toolModels = {
		image: { providerId: 'google', modelId: 'gemini-image', options: {} },
		audio: { providerId: 'elevenlabs', modelId: 'eleven-music', options: {} },
		video: { providerId: 'google', modelId: 'veo', options: {} },
	};
	let permissions = {
		read: { allow: [], deny: [] },
		write: { allow: [], deny: [] },
		exec: { allow: [], deny: [] },
	};
	let toolProfile = { tools: {}, mcp: {} };
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
			getToolModel: jest.fn().mockImplementation(async (kind) => toolModels[kind]),
			setToolModel: jest.fn().mockImplementation(async (kind, settings) => {
				toolModels[kind] = settings;
				return settings;
			}),
			policyGet: jest.fn().mockResolvedValue(permissions),
			policySet: jest.fn().mockImplementation(async (next) => {
				permissions = next;
				return next;
			}),
			getToolProfile: jest.fn().mockImplementation(async () => toolProfile),
			setToolProfileTool: jest.fn().mockImplementation(async (_profile, tool, settings) => {
				if (tool.kind === 'builtin') {
					toolProfile = { ...toolProfile, tools: { ...toolProfile.tools, [tool.id]: settings } };
				} else {
					toolProfile = {
						...toolProfile,
						mcp: {
							...toolProfile.mcp,
							[tool.serverId]: { ...toolProfile.mcp[tool.serverId], [tool.toolName]: settings },
						},
					};
				}
				return toolProfile;
			}),
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
	Object.defineProperty(window, 'provider', {
		configurable: true,
		value: {
			list: jest
				.fn()
				.mockResolvedValue([{ id: 'custom', name: 'Ollama', baseUrl: 'http://localhost:11434' }]),
			listCustomModels: jest.fn().mockResolvedValue(['gemma3:4b', 'llama3.2:1b']),
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
	Object.defineProperty(window, 'tasks', {
		configurable: true,
		value: {
			list: jest.fn().mockResolvedValue([]),
			getRuntime: jest.fn().mockResolvedValue({ providerId: 'openai', modelId: 'gpt' }),
			setRuntime: jest.fn().mockResolvedValue({ providerId: 'openai', modelId: 'gpt' }),
			setEnabled: jest.fn(),
		},
	});
	Object.defineProperty(window, 'mcp', {
		configurable: true,
		value: {
			registry: jest.fn().mockResolvedValue({ servers: [], diagnostics: [] }),
			test: jest.fn(),
		},
	});
	jest.clearAllMocks();
});

it('keeps chat, speech, and transcription configuration on the Chat page and links to Tools', async () => {
	const user = userEvent.setup();
	render(
		<MemoryRouter initialEntries={['/settings/agent']}>
			<Routes>
				<Route path="/settings/agent" element={<AssistantPage />} />
				<Route path="/settings/agent/tools" element={<ToolsPage />} />
				<Route path="/settings/agent/mcp-tools" element={<McpToolsPage />} />
			</Routes>
		</MemoryRouter>
	);

	expect(screen.queryByRole('heading', { name: 'Configuration' })).not.toBeInTheDocument();
	expect(screen.queryByRole('heading', { name: 'History' })).not.toBeInTheDocument();
	expect(screen.getByRole('heading', { name: 'Chat' })).toBeInTheDocument();
	expect(screen.getByRole('link', { name: /^Tools/ })).toHaveAttribute(
		'href',
		'/settings/agent/tools'
	);
	expect(screen.getByRole('link', { name: /^MCP Tools/ })).toHaveAttribute(
		'href',
		'/settings/agent/mcp-tools'
	);
	expect(screen.queryByRole('button', { name: 'Text to image' })).not.toBeInTheDocument();
	const model = (await screen.findAllByRole('button', { name: 'LLM Model' })).find(
		(element) => element.getAttribute('aria-haspopup') === 'dialog'
	);
	expect(model).toBeDefined();
	if (!model) return;
	expect(
		screen
			.getAllByRole('button', { name: /Speech/ })
			.some((element) => element.getAttribute('data-slot') === 'collapsible-trigger')
	).toBe(true);
	expect(
		screen
			.getAllByRole('button', { name: /Transcription/ })
			.some((element) => element.getAttribute('data-slot') === 'collapsible-trigger')
	).toBe(true);
	expect(screen.queryByRole('button', { name: /Realtime conversation/ })).not.toBeInTheDocument();
	expect(document.querySelector('.lucide-music-2')).toBeInTheDocument();
	expect(document.querySelector('.lucide-image')).toBeInTheDocument();
	expect(document.querySelector('.lucide-video')).toBeInTheDocument();
	expect(screen.queryByRole('link', { name: 'settings.tabs.skills' })).not.toBeInTheDocument();
	expect(screen.queryByRole('link', { name: 'settings.tabs.mcp' })).not.toBeInTheDocument();

	expect(screen.queryByRole('button', { name: /Permissions/ })).not.toBeInTheDocument();
	expect(screen.queryByRole('button', { name: /Data management/ })).not.toBeInTheDocument();

	await user.click(screen.getByRole('link', { name: /^Tools/ }));
	expect(await screen.findByRole('heading', { name: 'Tools' })).toBeInTheDocument();
});

it('keeps media permissions and search configuration on Tools without model selection', async () => {
	const user = userEvent.setup();
	render(
		<MemoryRouter>
			<ToolsPage />
		</MemoryRouter>
	);
	expect(
		screen.queryByRole('textbox', { name: 'settings.modelServices.agentTools.searchPlaceholder' })
	).not.toBeInTheDocument();

	for (const name of ['Text to image', 'Text to audio', 'Text to video']) {
		expect(screen.queryByRole('combobox', { name })).not.toBeInTheDocument();
		const permission = await screen.findByRole('button', { name: `${name}: Always Allow` });
		await waitFor(() => expect(permission).toBeEnabled());
	}
	expect(
		screen.queryByRole('link', { name: /settings\.permissions\.toolsTitle/ })
	).not.toBeInTheDocument();
	expect(window.agent.getToolModel).not.toHaveBeenCalled();
	expect(window.mcp.registry).not.toHaveBeenCalled();

	const searchTrigger = (await screen.findAllByRole('button', { name: /Search web/ })).find(
		(entry) => entry.getAttribute('data-slot') === 'collapsible-trigger'
	);
	expect(searchTrigger).toBeDefined();
	if (!searchTrigger) return;
	await user.click(searchTrigger);
	const search = await screen.findByRole('combobox', { name: 'Search web' });
	expect(search).toHaveTextContent('Brave');
	expect(screen.queryByText('Text to speech')).not.toBeInTheDocument();
	expect(screen.queryByText('Speech to text')).not.toBeInTheDocument();
});

it('shows MCP tools on their own Chat subpage', async () => {
	render(
		<MemoryRouter>
			<McpToolsPage />
		</MemoryRouter>
	);

	expect(await screen.findByRole('heading', { name: 'MCP Tools', level: 1 })).toBeInTheDocument();
	expect(
		screen.queryByRole('textbox', { name: 'settings.modelServices.agentTools.searchPlaceholder' })
	).not.toBeInTheDocument();
	expect(window.mcp.registry).toHaveBeenCalledTimes(1);
});

it('lists every built-in agent tool on the Tools page', async () => {
	render(
		<MemoryRouter>
			<ToolsPage />
		</MemoryRouter>
	);

	for (const tool of [
		'List remote agents',
		'Read file',
		'Screen recorder',
		'Query knowledge',
		'Run task now',
		'Load skill',
		'Get goal',
		'Complete bootstrap',
	]) {
		expect(await screen.findByText(tool)).toBeInTheDocument();
	}
	expect(screen.getByText('Text to image')).toBeInTheDocument();

	expect(document.querySelectorAll('code')).toHaveLength(0);
	for (const removed of [
		'save_memory',
		'list_memories',
		'forget_memory',
		'list_apps',
		'open_apps',
		'close_apps',
	])
		expect(screen.queryByText(removed)).not.toBeInTheDocument();
	expect(screen.queryByRole('switch')).not.toBeInTheDocument();
	expect(screen.getByText('Core')).toBeInTheDocument();
	expect(screen.queryByText('Files')).not.toBeInTheDocument();
	expect(screen.queryByText('Commands')).not.toBeInTheDocument();
	expect(
		screen.getByText('System').compareDocumentPosition(screen.getByText('Core'))
	).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
	expect(
		screen.getByText('Read file').compareDocumentPosition(screen.getByText('List remote agents'))
	).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
});

it('limits Health tools to file and command capabilities', async () => {
	render(
		<MemoryRouter>
			<ToolsPage profile="health" />
		</MemoryRouter>
	);

	expect(await screen.findByText('Read file')).toBeInTheDocument();
	expect(screen.getByText('Execute command')).toBeInTheDocument();
	expect(screen.queryByText('Search web')).not.toBeInTheDocument();
	expect(screen.queryByText('Query knowledge')).not.toBeInTheDocument();
	expect(screen.queryByText('Text to image')).not.toBeInTheDocument();
	expect(window.mcp.registry).not.toHaveBeenCalled();
});

it('saves a file tools permission choice', async () => {
	const user = userEvent.setup();
	render(
		<MemoryRouter>
			<ToolsPage />
		</MemoryRouter>
	);

	await user.click(await screen.findByRole('button', { name: 'Read file: Ask' }));

	await waitFor(() => {
		expect(window.agent.setToolProfileTool).toHaveBeenCalledWith(
			'chat',
			{ kind: 'builtin', id: 'read' },
			{ permission: 'ask' }
		);
	});
});

it('shows only runtime-supported realtime models and saves model and voice together', async () => {
	const user = userEvent.setup();
	render(
		<MemoryRouter>
			<VoicePage />
		</MemoryRouter>
	);
	expect(
		screen.getByRole('link', { name: /settings\.modelServices\.voiceHistoryTitle/ })
	).toHaveAttribute('href', '/settings/voice/history');

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
		prompt: 'Do the work',
		effort: 'medium' as const,
		sessionIds: [],
		createdAt: '2026-09-10T00:00:00.000Z',
		updatedAt: '2026-09-10T00:00:00.000Z',
	};
	(window.tasks.list as jest.Mock).mockResolvedValue([task]);
	(window.tasks.setEnabled as jest.Mock).mockResolvedValueOnce({ ...task, enabled: false });

	render(
		<MemoryRouter initialEntries={['/settings/tasks']}>
			<Routes>
				<Route path="/settings/tasks" element={<TasksPage />} />
				<Route path="/settings/tasks/:taskId/detail" element={<p>Task detail</p>} />
			</Routes>
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
	const taskItem = screen.getByRole('button', { name: 'Demo task' });
	expect(screen.getByRole('link', { name: /settings\.cron\.history\.pageTitle/ })).toHaveAttribute(
		'href',
		'/settings/tasks/history'
	);
	expect(taskItem.querySelector('[data-slot="switch"]')).toBe(taskSwitch);
	expect(taskItem).toHaveClass('cursor-pointer', 'hover:bg-muted/40');
	expect(taskSwitch).toBeChecked();
	await user.click(taskSwitch);
	await waitFor(() => {
		expect(window.tasks.setEnabled).toHaveBeenCalledWith('task-1', false);
		expect(taskSwitch).not.toBeChecked();
	});
	await user.click(taskItem);
	expect(await screen.findByText('Task detail')).toBeInTheDocument();
});

it('announces a realtime conversation setup save error', async () => {
	const user = userEvent.setup();
	realtimeSetSetup.mockRejectedValueOnce(new Error('Realtime setup could not be saved.'));
	render(
		<MemoryRouter>
			<VoicePage />
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
