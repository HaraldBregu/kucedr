import { createMemory } from './memory';
import type { MemoryService } from '../shared/memory_types';
import { AppState } from './app_state';
import { EventBus } from './event_bus';
import { WindowContextManager } from './window_context';
import { WindowFactory } from './window_factory';
import { LoggerService } from './shared';
import { AppRegistry, AppStorage } from './apps/app_index';

import { Agent } from './agent/agent';
import { modeExtension } from './agent/modes/extension';
import { ExecSandbox } from './agent/sandbox';
import { createRealtimeVoiceManager, type RealtimeVoiceManager } from './agent/realtime_voice';
import { StorageOperations, forkSync } from './backup';
import { withStorageLock } from './storage';
import { preventStorageSuspension } from './storage/storage_suspension';
import { StorageChannels } from '../shared/ipc_channels_definitions';
import type { StoragePullResult, StoragePushResult } from '../shared/storage_types';
import { Coding, CodingProjectStore, CodingStore } from './coding';
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
import { camera, microphone, screen } from './recorder';
import { startMcpCatalogBackfill } from './mcp';

export interface MainServices {
	appState: AppState;
	eventBus: EventBus;
	logger: LoggerService;
	agentService: Agent;
	memoryService: MemoryService;
	codingService: Coding;
	realtimeVoiceManager: RealtimeVoiceManager;
	windowFactory: WindowFactory;
	windowContextManager: WindowContextManager;
	appRegistry: AppRegistry;
	appStorage: AppStorage;
	storageOperations: StorageOperations;
	terminalManager: PtyManager;
	authService: AuthService;
	cloudService: CloudService;
}

export interface BootstrapResult extends MainServices {}

export function bootstrapServices(): BootstrapResult {
	void startMcpCatalogBackfill();
	const appState = new AppState();
	const eventBus = new EventBus();
	const logger = new LoggerService(eventBus);
	const appRegistry = new AppRegistry();
	const appStorage = new AppStorage();
	const windowFactory = new WindowFactory(logger, appRegistry);
	const memoryService = createMemory(() => agentService.config);
	const agentService = new Agent(new ExecSandbox(), memoryService, modeExtension);
	const codingStore = new CodingStore();
	const codingService = new Coding({
		store: codingStore,
		projects: new CodingProjectStore(),
	});
	const windowContextManager = new WindowContextManager(logger, eventBus);
	const realtimeVoiceManager = createRealtimeVoiceManager(agentService, eventBus);
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
			backup: () => forkSync<StoragePushResult>('backup'),
			restore: () => forkSync<StoragePullResult>('restore'),
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
		memoryService,
		codingService,
		conversationService,
		windowFactory,
		windowContextManager,
		appRegistry,
		appStorage,
		storageOperations,
		terminalManager,
		authService,
		cloudService,
	};
}

export async function cleanup(services: MainServices): Promise<void> {
	const {
		logger,
		windowContextManager,
		conversationService,
		terminalManager,
		cloudService,
		authService,
		agentService,
		memoryService,
		codingService,
		storageOperations,
	} = services;
	logger.info('Bootstrap', 'Starting cleanup');
	const recorderCleanup = Promise.all([microphone.destroy(), camera.destroy(), screen.destroy()]);
	terminalManager.shutdown();
	await memoryService.stop();
	agentService.destroy();
	codingService.destroy();
	await conversationService.execute({ type: 'voice', action: 'stop-all' });
	await windowContextManager.destroyAll();
	await storageOperations.settle();
	await recorderCleanup;
	await cloudService.destroy();
	authService.destroy();
	logger.info('Bootstrap', 'Cleanup complete');
	logger.destroy();
}
