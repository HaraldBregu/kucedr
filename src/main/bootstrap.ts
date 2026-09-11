import { AppState } from './app_state';
import { EventBus } from './event_bus';
import { WindowContextManager } from './window_context';
import { WindowFactory } from './window_factory';
import { LoggerService } from './shared';
import { createChannelRegistry, type ChannelRegistry } from './channels';
import { AppRegistry, AppStorage } from './apps/app_index';

import { Agent } from './agent/agent';
import { Conversation } from './agent/conversation';
import { ExecSandbox } from './agent/sandbox';
import { createRealtimeVoiceManager } from './agent/realtime_voice';
import { StorageOperations, pullFiles, pushFiles, withStorageLock } from './storage';
import { transferStorage } from './storage/s3/transfer';
import { storageProviders } from './storage/providers';
import { preventStorageSuspension } from './storage/storage_suspension';
import { StorageChannels } from '../shared/ipc_channels_definitions';
import { Coder, CodingProjectStore, CodingStore } from './coding';
import { getProvider, getStorageSettings } from './settings_store';
import { agentLocation } from './shared/agent_location';
import { EnvironmentManager } from './terminal/environment';
import { PtyManager } from './terminal/manager';
import { ShellDetector } from './terminal/shell';
import { AuthService } from './cloud/service';
import { CloudService } from './cloud/data';
import { loadCloudConfig } from './cloud/config';
import { AuthSessionStorage } from './cloud/session';
import { SupabaseAccountProvider } from './cloud/supabase/auth';
import { createSupabaseClient } from './cloud/supabase/client';
import { SupabaseCloudRepository } from './cloud/supabase/records';
import { SupabaseProviderCloud } from './cloud/supabase/providers';
import { ProviderSyncService } from './providers/sync';
import { providerVault } from './providers/vault';
import { camera, microphone, screen } from './recorder';

export interface MainServices {
	appState: AppState;
	eventBus: EventBus;
	logger: LoggerService;
	agentService: Agent;
	codingService: Coder;
	conversationService: Conversation;
	channelRegistry: ChannelRegistry;
	windowFactory: WindowFactory;
	windowContextManager: WindowContextManager;
	appRegistry: AppRegistry;
	appStorage: AppStorage;
	storageOperations: StorageOperations;
	terminalManager: PtyManager;
	authService: AuthService;
	cloudService: CloudService;
	providerSyncService: ProviderSyncService;
}

export interface BootstrapResult extends MainServices {}

export function bootstrapServices(): BootstrapResult {
	const appState = new AppState();
	const eventBus = new EventBus();
	const logger = new LoggerService(eventBus);
	const appRegistry = new AppRegistry();
	const appStorage = new AppStorage();
	const windowFactory = new WindowFactory(logger, appRegistry);
	const agentService = new Agent(windowFactory, new ExecSandbox());
	const codingStore = new CodingStore();
	const codingService = new Coder({
		store: codingStore,
		projects: new CodingProjectStore(
			undefined,
			[agentLocation(), codingStore.getLegacyWorkingDirectory()].filter(
				(directory): directory is string => Boolean(directory)
			)
		),
		getProvider: (providerId) => getProvider(providerId, 'models'),
	});
	const channelRegistry = createChannelRegistry({ logger, eventBus, agentService });
	const windowContextManager = new WindowContextManager(logger, eventBus);
	const realtimeVoiceManager = createRealtimeVoiceManager(agentService, windowFactory, eventBus);
	const conversationService = new Conversation(agentService, realtimeVoiceManager);
	const cloudConfig = loadCloudConfig();
	const authStorage = cloudConfig ? new AuthSessionStorage() : undefined;
	const cloudClient =
		cloudConfig && authStorage ? createSupabaseClient(cloudConfig, authStorage) : undefined;
	const accountProvider =
		cloudClient && cloudConfig && authStorage
			? new SupabaseAccountProvider(cloudClient, cloudConfig, authStorage)
			: undefined;
	const authService = new AuthService(accountProvider ?? null);
	const storageOperations = new StorageOperations(
		(status) => {
			eventBus.broadcastToWindows(StorageChannels.operationStatusChanged, status);
		},
		{
			backup: () =>
				transferStorage(storageProviders.resolve(getStorageSettings().providerId), pushFiles),
			restore: () =>
				transferStorage(storageProviders.resolve(getStorageSettings().providerId), pullFiles),
			lock: withStorageLock,
			preventSuspension: preventStorageSuspension,
		}
	);
	const terminalManager = new PtyManager(
		logger,
		new ShellDetector(),
		new EnvironmentManager(logger)
	);
	const cloudService = new CloudService(
		authService,
		cloudClient ? new SupabaseCloudRepository(cloudClient) : undefined
	);
	const providerSyncService = new ProviderSyncService(
		authService,
		providerVault,
		cloudClient ? new SupabaseProviderCloud(cloudClient) : undefined
	);
	eventBus.on('window:closed', (event) => {
		agentService.cancelWindow((event.payload as { windowId: number }).windowId);
		codingService.cancelWindow((event.payload as { windowId: number }).windowId);
		void conversationService.execute({
			type: 'voice',
			action: 'stop-window',
			windowId: (event.payload as { windowId: number }).windowId,
		});
	});

	logger.info('Bootstrap', 'Registered global services');

	return {
		appState,
		eventBus,
		logger,
		agentService,
		codingService,
		conversationService,
		channelRegistry,
		windowFactory,
		windowContextManager,
		appRegistry,
		appStorage,
		storageOperations,
		terminalManager,
		authService,
		cloudService,
		providerSyncService,
	};
}

export async function cleanup(services: MainServices): Promise<void> {
	const {
		logger,
		windowContextManager,
		channelRegistry,
		conversationService,
		terminalManager,
		cloudService,
		providerSyncService,
		authService,
		agentService,
		codingService,
		storageOperations,
	} = services;
	logger.info('Bootstrap', 'Starting cleanup');
	const recorderCleanup = Promise.all([microphone.destroy(), camera.destroy(), screen.destroy()]);
	terminalManager.shutdown();
	agentService.destroy();
	codingService.destroy();
	await conversationService.execute({ type: 'voice', action: 'stop-all' });
	await windowContextManager.destroyAll();
	await storageOperations.settle();
	await recorderCleanup;
	await cloudService.destroy();
	providerSyncService.destroy();
	authService.destroy();
	await channelRegistry.destroy();
	logger.info('Bootstrap', 'Cleanup complete');
	logger.destroy();
}
