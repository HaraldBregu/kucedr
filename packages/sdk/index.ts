import type { AgentApi, AppApi, CoderApi, ModelsApi, WindowApi } from '../../src/shared/api_types';
import type { TerminalApi } from '../../src/shared/terminal';

export {
	connect,
	type ConnectOptions,
	type KucedrClient,
	type RemoteAppApi,
	type WorkspaceAgentApi,
} from './connect';
export type { AgentApi, AppApi, CoderApi, ModelsApi, WindowApi } from '../../src/shared/api_types';
export type {
	TerminalApi,
	TerminalCreateRequest,
	TerminalDataEvent,
	TerminalExitEvent,
	TerminalKillRequest,
	TerminalResizeRequest,
	TerminalSessionInfo,
	TerminalWriteRequest,
} from '../../src/shared/terminal';
export type {
	AppLanguage,
	AppLaunchState,
	AppTheme,
	AppThemeColors,
	AppThemeData,
} from '../../src/shared/app_types';
export type { UrlMetadata } from '../../src/shared/app_types';
export type { App, AppManifest, AppMetadata } from '../../src/shared/installed_app_types';
export {
	APP_WINDOW_DEFAULTS,
	type AppWindowSettings,
	type ResolvedAppWindowSettings,
} from '../../src/shared/app_window_settings';
export { isAppWindowSettings } from '../../src/shared/app_window_validate';
export type {
	CatalogModel,
	ModelCapability,
	ModelInputSchema,
	ProviderModel,
} from '../../src/shared/model_types';
export {
	IMAGE_SOURCE_MAX_BYTES,
	normalizeImageSource,
	type ImageRequest,
	type ImageResult,
	type ImageSource,
} from '../../src/shared/image_types';
export type { WorkspaceChangeEvent, WorkspaceTreeEntry } from '../../src/shared/agent_types';
export {
	workspaceFileType,
	type WorkspaceAsset,
	type WorkspaceFileKind,
	type WorkspaceFileType,
} from '../../src/shared/workspace';
export {
	APP_TITLEBAR_BUTTON_ICONS,
	type ContextMenuDescriptor,
	type ContextMenuRole,
	type AppTitlebarButton,
	type AppTitlebarButtonIcon,
	type AppTitlebarOptions,
} from '../../src/shared/window_types';
export {
	CODER_PROVIDER_IDS,
	CODER_THINKING_LEVELS,
	CODER_TOOL_MODES,
	isCoderRunRequest,
	isCoderSettings,
	type CoderAuthEvent,
	type CoderAuthStatus,
	type CoderCatalog,
	type CoderModel,
	type CoderProvider,
	type CoderProviderId,
	type CoderProject,
	type CoderProjectInstructionScope,
	type CoderProjectInstructionSource,
	type CoderProjectInstructions,
	type CoderProjectInstructionsUpdate,
	type CoderResponseEvent,
	type CoderRunMode,
	type CoderRunRequest,
	type CoderRunResult,
	type CoderSessionBlock,
	type CoderSessionSnapshot,
	type CoderSessionSummary,
	type CoderSettings,
	type CoderThinkingLevel,
	type CoderToolMode,
} from '../../src/shared/coder_types';
export type {
	AppStorageApi,
	AppStoreValue,
} from '../../src/shared/app_store_types';
export { isAppStoreValue } from '../../src/shared/app_store_value';

// Typed lazy views over the host preload globals.
function bridge<T extends object>(name: string): T {
	return new Proxy({} as T, {
		get(_target, key) {
			const api = (globalThis as Record<string, unknown>)[name] as
				| Record<string | symbol, unknown>
				| undefined;
			if (!api)
				throw new Error(
					`@kucedr/sdk: "${name}" is unavailable — this code must run inside the Kucedr app.`
				);
			if (!(key in api)) {
				throw new Error(
					`@kucedr/sdk: "${name}.${String(key)}" is unavailable — update the Kucedr host.`
				);
			}
			const value = api[key];
			return typeof value === 'function' ? value.bind(api) : value;
		},
	});
}

export const app = bridge<AppApi>('app');
export const agent = bridge<AgentApi>('agent');
export const coder = bridge<CoderApi>('coder');
export const models = bridge<ModelsApi>('models');
export const terminal = bridge<TerminalApi>('terminalAPI');
export const win = bridge<WindowApi>('win');

const requiredMethods = [
	'getThemeData',
	'setTheme',
	'getLanguage',
	'setLanguage',
	'onThemeModeChanged',
] as const;

function hasAppMethods(api: unknown): api is AppApi {
	if (typeof api !== 'object' || api === null) return false;
	for (const method of requiredMethods) {
		if (typeof (api as Record<string, unknown>)[method] !== 'function') return false;
	}
	return true;
}

export function isKucedr(): boolean {
	const kucedrApp = (globalThis as Record<string, unknown>).app;
	return hasAppMethods(kucedrApp);
}
