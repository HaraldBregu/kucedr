import type { AgentApi, AppApi, CodingApi, ModelsApi, WindowApi } from '../../src/shared/api_types';
import type { TerminalApi } from '../../src/shared/terminal';

export {
	connect,
	type ConnectOptions,
	type KucedrClient,
	type RemoteAppApi,
	type WorkspaceAgentApi,
} from './connect';
export type { AgentApi, AppApi, CodingApi, ModelsApi, WindowApi } from '../../src/shared/api_types';
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
export type { EmbeddingRequest, EmbeddingResult } from '../../src/shared/embedding_types';
export type { SoundFile, SoundRequest, SoundResult } from '../../src/shared/sound_types';
export type { TextRequest } from '../../src/shared/text_types';
export type { VideoRequest, VideoResult } from '../../src/shared/video_types';
export {
	SPEECH_MAX_TEXT_LENGTH,
	type SpeechSynthesisMetadata,
	type SpeechSynthesisRequest,
	type SpeechSynthesisResult,
} from '../../src/shared/speech_types';
export {
	STT_AUDIO_ENCODINGS,
	STT_DEFAULT_REALTIME_SAMPLE_RATE,
	STT_MAX_AUDIO_BASE64_LENGTH,
	STT_MAX_LANGUAGE_LENGTH,
	STT_MAX_PROMPT_LENGTH,
	STT_MAX_REALTIME_AUDIO_BASE64_LENGTH,
	type SttAudioEncoding,
	type SttAudioInput,
	type SttModelSelection,
	type SttRealtimeAudioFormat,
	type SttRealtimeEvent,
	type SttRealtimeSession,
	type SttRealtimeStartRequest,
	type SttSelectionMode,
	type SttTranscriptionMetadata,
	type SttTranscriptionRequest,
	type SttTranscriptionResult,
	type SttUsage,
} from '../../src/shared/stt_transcription';
export {
	REALTIME_VOICE_CHANNELS,
	REALTIME_VOICE_MAX_AUDIO_BASE64_LENGTH,
	REALTIME_VOICE_SAMPLE_RATE,
	type RealtimeVoiceAudioFormat,
	type RealtimeVoiceEvent,
	type RealtimeVoiceModelRef,
	type RealtimeVoiceSession,
	type RealtimeVoiceSetup,
	type RealtimeVoiceSetupRequest,
	type RealtimeVoiceStartRequest,
	type RealtimeVoiceState,
	type RealtimeVoiceToolEvent,
} from '../../src/shared/realtime_voice';
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
	CODING_PROVIDER_IDS,
	CODING_THINKING_LEVELS,
	CODING_TOOL_MODES,
	isCodingRunRequest,
	isCodingSettings,
	type CodingAuthEvent,
	type CodingAuthStatus,
	type CodingCatalog,
	type CodingModel,
	type CodingProvider,
	type CodingProviderId,
	type CodingProject,
	type CodingProjectFile,
	type CodingProjectInstructionScope,
	type CodingProjectInstructionSource,
	type CodingProjectInstructions,
	type CodingProjectInstructionsUpdate,
	type CodingResponseEvent,
	type CodingRunMode,
	type CodingRunRequest,
	type CodingRunResult,
	type CodingSessionBlock,
	type CodingSessionSnapshot,
	type CodingSessionSummary,
	type CodingSettings,
	type CodingThinkingLevel,
	type CodingToolMode,
} from '../../src/shared/coding_types';
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
export const coding = bridge<CodingApi>('coding');
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
