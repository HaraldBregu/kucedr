import { AgentIpc } from '../agent';
import { A2aIpc } from '../a2a';
import { AppIpc } from '../app';
import { RecorderIpc } from '../recorder';
import { TaskIpc } from '../tasks';
import { McpIpc } from '../mcp';
import { ModelsIpc } from '../models';
import { SkillsIpc } from '../skills';
import { ProviderStoreIpc } from '../provider';
import { SearchIpc } from '../search';
import { StorageIpc } from '../storage';
import { DatabaseIpc } from '../database';
import { AppsIpc } from '../apps';
import { WikiIpc } from '../wiki';
import { WindowIpc } from '../window';
import { DataIpc } from '../data';
import { RealtimeVoiceIpc } from '../realtime_voice';
import { CodingIpc } from '../coder';
import { TerminalIpc } from '../terminal';
import { AuthIpc } from '../auth';
import { CloudIpc } from '../cloud';
import type { EventBus } from '../../event_bus';
import type { MainServices } from '../../bootstrap';

export function registerIpcHandlers(
	services: MainServices,
	eventBus: EventBus,
	options: { openVoiceConversation?: (chatSessionId: string) => void } = {}
): void {
	const {
		logger,
		agentService,
		codingService,
		conversationService,
		channelRegistry,
		windowFactory,
		appRegistry,
		appStorage,
		storageOperations,
		terminalManager,
		windowContextManager,
		authService,
		cloudService,
		providerSyncService,
	} = services;

	const safeRegister = (name: string, register: () => void): void => {
		try {
			register();
		} catch (error) {
			logger.error('Bootstrap', `Failed to register IPC module: ${name}`, error);
		}
	};

	safeRegister('app', () =>
		new AppIpc().register(
			{
				logger,
				channelRegistry,
				appRegistry,
				appStorage,
				sandbox: agentService.sandbox,
			},
			eventBus
		)
	);
	safeRegister('a2a', () => new A2aIpc().register({ appRegistry }, eventBus));
	safeRegister('auth', () =>
		new AuthIpc().register(
			{ auth: authService, windows: windowContextManager, apps: appRegistry },
			eventBus
		)
	);
	safeRegister('cloud', () =>
		new CloudIpc().register(
			{ cloud: cloudService, windows: windowContextManager, apps: appRegistry },
			eventBus
		)
	);
	safeRegister('agent', () =>
		new AgentIpc().register(
			{
				logger,
				agent: agentService,
				conversation: conversationService,
				windows: windowContextManager,
				apps: appRegistry,
			},
			eventBus
		)
	);
	safeRegister('coder', () =>
		new CodingIpc().register(
			{ coder: codingService, appRegistry, windows: windowContextManager },
			eventBus
		)
	);
	safeRegister('recorder', () =>
		new RecorderIpc().register({ windows: windowContextManager, apps: appRegistry }, eventBus)
	);
	safeRegister('tasks', () =>
		new TaskIpc().register(
			{ windows: windowContextManager, apps: appRegistry, agent: agentService },
			eventBus
		)
	);
	safeRegister('mcp', () =>
		new McpIpc().register({ windows: windowContextManager, apps: appRegistry }, eventBus)
	);
	safeRegister('models', () =>
		new ModelsIpc().register({ windows: windowContextManager, apps: appRegistry }, eventBus)
	);
	safeRegister('realtime-voice', () =>
		new RealtimeVoiceIpc().register(
			{
				conversation: conversationService,
				windows: windowContextManager,
				apps: appRegistry,
			},
			eventBus
		)
	);
	safeRegister('skills', () =>
		new SkillsIpc().register({ windows: windowContextManager, apps: appRegistry }, eventBus)
	);
	safeRegister('provider-store', () =>
		new ProviderStoreIpc().register(
			{
				sync: providerSyncService,
				windows: windowContextManager,
				apps: appRegistry,
			},
			eventBus
		)
	);
	safeRegister('search', () =>
		new SearchIpc().register({ windows: windowContextManager, apps: appRegistry }, eventBus)
	);
	safeRegister('storage', () =>
		new StorageIpc().register(
			{ appRegistry, storageOperations, windows: windowContextManager },
			eventBus
		)
	);
	safeRegister('database', () =>
		new DatabaseIpc().register({ windows: windowContextManager, apps: appRegistry }, eventBus)
	);
	safeRegister('apps', () =>
		new AppsIpc().register({ windowFactory, appRegistry, windows: windowContextManager }, eventBus)
	);
	safeRegister('wiki', () =>
		new WikiIpc().register({ windows: windowContextManager, apps: appRegistry }, eventBus)
	);
	safeRegister('data', () =>
		new DataIpc().register(
			{
				agent: agentService,
				windows: windowContextManager,
				apps: appRegistry,
			},
			eventBus
		)
	);
	safeRegister('window', () =>
		new WindowIpc().register(
			{ logger, appRegistry, openVoiceConversation: options.openVoiceConversation },
			eventBus
		)
	);
	safeRegister('terminal', () =>
		new TerminalIpc().register(
			{
				logger,
				manager: terminalManager,
				windows: windowContextManager,
				apps: appRegistry,
			},
			eventBus
		)
	);

	logger.info('Bootstrap', 'Registered IPC modules');
}
